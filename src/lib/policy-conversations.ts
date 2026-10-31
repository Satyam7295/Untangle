import { Prisma, PrismaClient } from "@prisma/client";

import type { QueryAnalysisResult } from "./query-analysis";
import type { PolicyQueryResponse } from "./policy-query-response";
import { getDatabaseUrl } from "./env";
import type { DecisionResult } from "./business-rules/types";

export type ConversationPersistenceClient = Pick<PrismaClient, "$transaction">;

function defaultClient(): ConversationPersistenceClient {
  return new PrismaClient({ datasourceUrl: getDatabaseUrl() });
}

let clientInstance: ConversationPersistenceClient | undefined;

function getDefaultClient(): ConversationPersistenceClient {
  clientInstance ??= defaultClient();
  return clientInstance;
}

function isPersistenceError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError
    || error instanceof Prisma.PrismaClientInitializationError
    || (error instanceof Error && error.name.startsWith("PrismaClient"));
}

function decisionOutcome(result: QueryAnalysisResult): "ROUTED" | "ESCALATED" | "HUMAN_REVIEW" | "NO_MATCH" {
  if ("interpretation" in result) {
    return result.interpretation.humanReviewRequired || result.status === "HUMAN_REVIEW_REQUIRED"
      ? "HUMAN_REVIEW"
      : "ROUTED";
  }
  return "NO_MATCH";
}

function shouldEscalate(result: QueryAnalysisResult): boolean {
  return "interpretation" in result
    && (result.status === "HUMAN_REVIEW_REQUIRED" || result.interpretation.humanReviewRequired);
}

function ruleEscalation(decision?: DecisionResult) {
  if (!decision || decision.recommendation !== "APPLY" || decision.conflicts.length > 0) return null;
  const escalation = decision.proposedActions.find((action) => action.type === "ESCALATE");
  if (!escalation) return null;
  return {
    ruleId: escalation.ruleId,
    level: Number.parseInt(escalation.value, 10),
    conditions: decision.matchedRules.find((rule) => rule.ruleId === escalation.ruleId)?.conditions ?? [],
    reason: `Escalated by approved business rule "${escalation.ruleName}".`,
  };
}

function ruleAssignments(decision?: DecisionResult) {
  if (!decision || decision.recommendation !== "APPLY" || decision.conflicts.length > 0) return {};
  const priority = decision.proposedActions.find((action) => action.type === "SET_PRIORITY");
  const team = decision.proposedActions.find((action) => action.type === "ASSIGN_TEAM");
  return {
    ...(priority ? { priorityId: priority.value } : {}),
    ...(team ? { assignedTeamId: team.value } : {}),
  };
}

function evidenceForResult(result: QueryAnalysisResult) {
  if (!("interpretation" in result)) return [];
  const sourceIds = new Set(result.interpretation.sourceIds);
  return result.retrieval.excerpts
    .filter((excerpt) => sourceIds.has(excerpt.chunkId))
    .map((excerpt) => ({
      sourceId: excerpt.chunkId,
      documentName: result.retrieval.policy?.fileName ?? result.retrieval.policy?.title ?? "Policy document",
      pageStart: excerpt.pageStart,
      pageEnd: excerpt.pageEnd,
      excerpt: excerpt.excerpt,
      relevanceScore: excerpt.similarity,
    }));
}

export async function conversationAwaitingSupport(conversationId: string, tenantId: string): Promise<boolean> {
  const { prisma } = await import("./prisma");
  const ticket = await prisma.ticket.findFirst({
    where: { conversationId, tenantId },
    select: { status: true },
  });
  return ticket?.status === "ESCALATED";
}

export async function appendAwaitingSupportMessage(
  conversationId: string,
  tenantId: string,
  content: string,
) {
  const { prisma } = await import("./prisma");
  return prisma.$transaction(async (transaction) => {
    const ticket = await transaction.ticket.findFirst({
      where: { conversationId, tenantId, status: "ESCALATED" },
      select: { id: true },
    });
    if (!ticket) return null;
    await transaction.conversationMessage.create({
      data: { ticketId: ticket.id, authorRole: "USER", content },
    });
    return ticket.id;
  });
}

async function persistOnce(
  conversationId: string,
  query: string,
  tenantId: string,
  result: QueryAnalysisResult,
  response: PolicyQueryResponse,
  client: ConversationPersistenceClient,
  decision?: DecisionResult,
) {
  return client.$transaction(async (tx) => {
    const existing = await tx.ticket.findUnique({
      where: { conversationId },
      select: { id: true, triggeringBusinessRuleId: true, status: true },
    });
    const ruleEscalationResult = ruleEscalation(decision);
    const assignments = ruleAssignments(decision);
    const deterministicReview = decision?.recommendation === "HUMAN_REVIEW";
    const escalated = shouldEscalate(result) || Boolean(ruleEscalationResult) || deterministicReview;
    const deterministicReason = ruleEscalationResult?.reason
      ?? (deterministicReview ? "Conflicting or invalid business rules require human review." : undefined);
    const ticket = existing
      ? await tx.ticket.update({
        where: { id: existing.id },
        data: {
          ...assignments,
          ...(escalated ? {
          status: "ESCALATED",
          escalationLevel: ruleEscalationResult?.level || 1,
          ...(ruleEscalationResult ? {
            triggeringBusinessRuleId: ruleEscalationResult.ruleId,
            matchedConditions: ruleEscalationResult.conditions,
            escalationReason: deterministicReason,
          } : deterministicReason ? {
            escalationReason: deterministicReason,
          } : {}),
          } : {}),
        },
        select: { id: true, referenceNumber: true },
      })
      : await tx.ticket.create({
        data: {
          conversationId,
          tenantId,
          originalQuery: query,
          status: escalated ? "ESCALATED" : "OPEN",
          escalationLevel: ruleEscalationResult?.level || (escalated ? 1 : 0),
          ...assignments,
          ...(ruleEscalationResult ? {
            triggeringBusinessRuleId: ruleEscalationResult.ruleId,
            matchedConditions: ruleEscalationResult.conditions,
            escalationReason: deterministicReason,
          } : deterministicReason ? {
            escalationReason: deterministicReason,
          } : {}),
        },
        select: { id: true, referenceNumber: true },
      });

    const decisionRecord = await tx.decisionRecord.create({
      data: {
        ticketId: ticket.id,
        outcome: decisionOutcome(result),
        explanation: "interpretation" in result
          ? result.interpretation as unknown as Prisma.InputJsonValue
          : { status: result.status, answer: response.answer },
        humanReviewRequired: escalated,
        matchedRules: {
          create: (decision?.matchedRules ?? []).map((rule) => ({ businessRuleId: rule.ruleId })),
        },
        evidence: { create: evidenceForResult(result) },
      },
      select: { id: true },
    });

    await tx.conversationMessage.createMany({
      data: [
        { ticketId: ticket.id, authorRole: "USER", content: query },
        {
          ticketId: ticket.id,
          authorRole: "ASSISTANT",
          content: response.clarificationQuestion
            ? `${response.answer}\n\n${response.clarificationQuestion}`
            : response.answer,
        },
      ],
    });
    if ((ruleEscalationResult || deterministicReview) && (
      !existing
      || existing.status !== "ESCALATED"
      || (ruleEscalationResult && existing.triggeringBusinessRuleId !== ruleEscalationResult.ruleId)
    )) {
      await tx.auditEvent?.create?.({
        data: {
          eventType: "CASE_ESCALATED",
          entityType: "Ticket",
          entityId: ticket.id,
          metadata: {
            ...(ruleEscalationResult ? {
              businessRuleId: ruleEscalationResult.ruleId,
              matchedConditions: ruleEscalationResult.conditions,
            } : {}),
            reason: deterministicReason,
          },
        },
      });
    }
    return { ...ticket, decisionId: decisionRecord.id, escalated };
  });
}

export async function persistPolicyConversation(
  conversationId: string,
  query: string,
  tenantId: string,
  result: QueryAnalysisResult,
  response: PolicyQueryResponse,
  client: ConversationPersistenceClient = getDefaultClient(),
  decision?: DecisionResult,
) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(conversationId)) {
    throw new Error("A valid conversation identifier is required.");
  }
  try {
    return await persistOnce(conversationId, query, tenantId, result, response, client, decision);
  } catch (error) {
    if (isPersistenceError(error) && (error as { code?: string }).code === "P2002") {
      return persistOnce(conversationId, query, tenantId, result, response, client, decision);
    }
    throw error;
  }
}
