import { Prisma, PrismaClient } from "@prisma/client";

import type { QueryAnalysisResult } from "./query-analysis";
import type { PolicyQueryResponse } from "./policy-query-response";
import { getDatabaseUrl } from "./env";

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

async function persistOnce(
  conversationId: string,
  query: string,
  tenantId: string,
  result: QueryAnalysisResult,
  response: PolicyQueryResponse,
  client: ConversationPersistenceClient,
) {
  return client.$transaction(async (tx) => {
    const existing = await tx.ticket.findUnique({ where: { conversationId }, select: { id: true } });
    const escalated = shouldEscalate(result);
    const ticket = existing
      ? await tx.ticket.update({
        where: { id: existing.id },
        data: escalated ? { status: "ESCALATED", escalationLevel: 1 } : {},
        select: { id: true, referenceNumber: true },
      })
      : await tx.ticket.create({
        data: {
          conversationId,
          tenantId,
          originalQuery: query,
          status: escalated ? "ESCALATED" : "OPEN",
          escalationLevel: escalated ? 1 : 0,
        },
        select: { id: true, referenceNumber: true },
      });

    const decision = await tx.decisionRecord.create({
      data: {
        ticketId: ticket.id,
        outcome: decisionOutcome(result),
        explanation: "interpretation" in result
          ? result.interpretation as unknown as Prisma.InputJsonValue
          : { status: result.status, answer: response.answer },
        humanReviewRequired: escalated,
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
    return { ...ticket, decisionId: decision.id };
  });
}

export async function persistPolicyConversation(
  conversationId: string,
  query: string,
  tenantId: string,
  result: QueryAnalysisResult,
  response: PolicyQueryResponse,
  client: ConversationPersistenceClient = getDefaultClient(),
) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(conversationId)) {
    throw new Error("A valid conversation identifier is required.");
  }
  try {
    return await persistOnce(conversationId, query, tenantId, result, response, client);
  } catch (error) {
    if (isPersistenceError(error) && (error as { code?: string }).code === "P2002") {
      return persistOnce(conversationId, query, tenantId, result, response, client);
    }
    throw error;
  }
}
