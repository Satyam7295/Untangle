import { Prisma } from "@prisma/client";

import { validateRuntimeContext } from "./business-rules/evaluator";
import { loadAndEvaluateBusinessRules } from "./business-rules/repository";
import type { DecisionResult, ProposedAction, RuntimeContext } from "./business-rules/types";
import { prisma } from "./prisma";

const MAX_QUERY_LENGTH = 5000;
const CONTEXT_FIELDS = ["categoryId", "subcategoryId", "priorityId", "assignedTeamId"] as const;

export type QueryProcessingResult = {
  query: string;
  context: RuntimeContext;
  decision: DecisionResult;
  persisted: boolean;
  ticket?: {
    id: string;
    referenceNumber: string;
  };
  error?: string;
};

export type QueryPersistenceClient = Pick<typeof prisma, "$transaction">;

function readContext(formData: FormData): { value?: unknown; error?: string } {
  const context: Record<string, unknown> = { status: "OPEN" };
  const structuredContext = formData.get("context");
  if (typeof structuredContext === "string" && structuredContext.trim()) {
    try {
      const parsed = JSON.parse(structuredContext);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return { error: "Structured context must be a JSON object." };
      }
      Object.assign(context, parsed);
    } catch {
      return { error: "Structured context must be valid JSON." };
    }
  }
  const status = formData.get("status");
  if (typeof status === "string" && status.trim()) context.status = status.trim();
  for (const field of CONTEXT_FIELDS) {
    const value = formData.get(field);
    if (typeof value === "string" && value.trim()) context[field] = value.trim();
  }
  return { value: context };
}

export function validateSupportQuery(value: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== "string" || !value.trim()) return { ok: false, error: "Write a support query before submitting." };
  const query = value.trim();
  if (query.length > MAX_QUERY_LENGTH) return { ok: false, error: `Support queries must be ${MAX_QUERY_LENGTH} characters or fewer.` };
  return { ok: true, value: query };
}

export function parseSupportQuery(formData: FormData):
  | { ok: true; query: string; context: RuntimeContext }
  | { ok: false; error: string } {
  const query = validateSupportQuery(formData.get("query"));
  if (!query.ok) return query;

  const rawContext = readContext(formData);
  if (rawContext.error) return { ok: false, error: rawContext.error };
  const context = validateRuntimeContext(rawContext.value);
  if (!context.ok) return { ok: false, error: context.errors.join(" ") };
  return { ok: true, query: query.value, context: context.value };
}

function actionError(action: ProposedAction): string {
  return `The rule action ${action.type} references an unavailable configuration value.`;
}

async function validateActionReferences(tx: Prisma.TransactionClient, actions: ProposedAction[]): Promise<string | null> {
  for (const action of actions) {
    if (action.type === "ESCALATE") {
      if (!/^\d+$/.test(action.value)) return actionError(action);
      continue;
    }

    const record = action.type === "SET_PRIORITY"
      ? await tx.priorityLevel.findUnique({ where: { id: action.value }, select: { id: true, isActive: true } })
      : action.type === "ASSIGN_TEAM"
        ? await tx.team.findUnique({ where: { id: action.value }, select: { id: true, isActive: true } })
        : await tx.category.findUnique({ where: { id: action.value }, select: { id: true, isActive: true } });
    if (!record?.isActive) return actionError(action);
  }
  return null;
}

async function validateContextReferences(tx: Prisma.TransactionClient, context: RuntimeContext): Promise<string | null> {
  if (context.categoryId && !(await tx.category.findUnique({ where: { id: context.categoryId }, select: { id: true, isActive: true } }))?.isActive) {
    return "The selected category is unavailable.";
  }
  if (context.subcategoryId && !(await tx.subcategory.findUnique({ where: { id: context.subcategoryId }, select: { id: true, isActive: true } }))?.isActive) {
    return "The selected subcategory is unavailable.";
  }
  if (context.priorityId && !(await tx.priorityLevel.findUnique({ where: { id: context.priorityId }, select: { id: true, isActive: true } }))?.isActive) {
    return "The selected priority is unavailable.";
  }
  if (context.assignedTeamId && !(await tx.team.findUnique({ where: { id: context.assignedTeamId }, select: { id: true, isActive: true } }))?.isActive) {
    return "The selected assigned team is unavailable.";
  }
  return null;
}

function actionData(actions: ProposedAction[]): {
  priority?: { connect: { id: string } };
  assignedTeam?: { connect: { id: string } };
  category?: { connect: { id: string } };
  escalationLevel?: number;
  status?: "ESCALATED";
} {
  const data: ReturnType<typeof actionData> = {};
  for (const action of actions) {
    if (action.type === "SET_PRIORITY") data.priority = { connect: { id: action.value } };
    if (action.type === "ASSIGN_TEAM") data.assignedTeam = { connect: { id: action.value } };
    if (action.type === "SET_CATEGORY") data.category = { connect: { id: action.value } };
    if (action.type === "ESCALATE") {
      data.escalationLevel = Number(action.value);
      data.status = "ESCALATED";
    }
  }
  return data;
}

export async function processSupportQuery(
  formData: FormData,
  client: QueryPersistenceClient = prisma,
): Promise<QueryProcessingResult | { error: string }> {
  const parsed = parseSupportQuery(formData);
  if (!parsed.ok) return parsed;

  const decision = await loadAndEvaluateBusinessRules(parsed.context);
  if (decision.status === "INVALID_CONTEXT") {
    return { error: decision.validationErrors.join(" ") || "The query context is invalid." };
  }

  const safeToApply = decision.recommendation === "APPLY" &&
    decision.conflicts.length === 0 &&
    decision.validationErrors.length === 0;
  const effectiveRecommendation = safeToApply
    ? decision.recommendation
    : decision.recommendation === "NO_MATCH" && decision.validationErrors.length === 0
      ? decision.recommendation
      : "HUMAN_REVIEW";
  const explainableDecision: DecisionResult = { ...decision, recommendation: effectiveRecommendation };
  const humanReviewRequired = effectiveRecommendation === "HUMAN_REVIEW";
  const actions = safeToApply ? decision.proposedActions : [];

  try {
    const ticket = await client.$transaction(async (tx) => {
      const contextError = await validateContextReferences(tx, parsed.context);
      if (contextError) throw new Error(contextError);
      const referenceError = await validateActionReferences(tx, actions);
      if (referenceError) throw new Error(referenceError);

      const created = await tx.ticket.create({
        data: {
          originalQuery: parsed.query,
          status: "OPEN",
          ...(parsed.context.categoryId ? { category: { connect: { id: parsed.context.categoryId } } } : {}),
          ...(parsed.context.subcategoryId ? { subcategory: { connect: { id: parsed.context.subcategoryId } } } : {}),
          ...(parsed.context.priorityId ? { priority: { connect: { id: parsed.context.priorityId } } } : {}),
          ...(parsed.context.assignedTeamId ? { assignedTeam: { connect: { id: parsed.context.assignedTeamId } } } : {}),
          ...actionData(actions),
          decisions: {
            create: {
              outcome: effectiveRecommendation === "APPLY"
                ? actions.some((action) => action.type === "ESCALATE") ? "ESCALATED" : "ROUTED"
                : effectiveRecommendation === "NO_MATCH" ? "NO_MATCH" : "HUMAN_REVIEW",
              explanation: explainableDecision as unknown as Prisma.InputJsonValue,
              humanReviewRequired,
              matchedRules: {
                create: decision.matchedRules.map((rule) => ({ businessRuleId: rule.ruleId })),
              },
            },
          },
        },
        select: { id: true, referenceNumber: true },
      });
      return created;
    });
    return { query: parsed.query, context: parsed.context, decision: explainableDecision, persisted: true, ticket };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The query could not be persisted." };
  }
}
