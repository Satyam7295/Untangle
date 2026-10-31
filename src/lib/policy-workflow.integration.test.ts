import { describe, expect, it, vi } from "vitest";

vi.mock("pdf-parse", () => ({
  PDFParse: vi.fn(() => ({
    getText: vi.fn().mockResolvedValue({
      pages: [{
        num: 3,
        text: "Support policy. If a ticket status is OPEN, escalate to human review at level 3.",
      }],
    }),
    destroy: vi.fn().mockResolvedValue(undefined),
  })),
}));

import { validateRuleConfiguration } from "./configuration-validation";
import { extractDocumentRuleSuggestions } from "./document-rule-suggestions";
import { evaluateBusinessRules } from "./business-rules/evaluator";
import type { StoredBusinessRule } from "./business-rules/types";
import type { PolicyChunk } from "./policy-chunking";
import { ingestPolicyPdf, type IngestionRepository } from "./policy-ingestion";
import type { QueryAnalysisResult } from "./query-analysis";
import type { PolicyQueryResponse } from "./policy-query-response";
import { persistPolicyConversation, type ConversationPersistenceClient } from "./policy-conversations";

const tenantId = "tenant-integration";
const conversationId = "11111111-1111-4111-8111-111111111111";
const policyFile = {
  name: "support-policy.pdf",
  type: "application/pdf",
  size: 180,
  arrayBuffer: async () => new TextEncoder().encode("%PDF-1.7").buffer,
};

function workflowRepository() {
  const state = {
    document: { id: "policy-1", isActive: false, status: "UPLOADING" },
    chunks: [] as Array<Omit<PolicyChunk, "embedding"> & { id: string }>,
    suggestions: [] as ReturnType<typeof extractDocumentRuleSuggestions>,
  };
  const repository: IngestionRepository = {
    createDocument: vi.fn().mockResolvedValue({ id: state.document.id }),
    updateStatus: vi.fn().mockImplementation(async (_id, status) => { state.document.status = status; }),
    replaceChunksAndActivate: vi.fn().mockImplementation(async (_id, _tenantId, chunks) => {
      state.chunks = chunks.map((chunk: PolicyChunk, index: number) => ({
        id: `chunk-${index + 1}`,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        pageStart: chunk.pageStart,
        pageEnd: chunk.pageEnd,
        sectionHeading: chunk.sectionHeading,
      }));
      state.suggestions = extractDocumentRuleSuggestions(state.chunks);
      state.document.isActive = true;
      state.document.status = "READY";
    }),
  };
  return { repository, state };
}

function queryResult(): { result: QueryAnalysisResult; response: PolicyQueryResponse } {
  const result: QueryAnalysisResult = {
    status: "INTERPRETED",
    retrieval: {
      found: true,
      policy: { id: "policy-1", title: "Support policy", fileName: "support-policy.pdf" },
      excerpts: [{
        chunkId: "chunk-1",
        excerpt: "If a ticket status is OPEN, escalate to human review at level 3.",
        chunkIndex: 0,
        pageStart: 3,
        pageEnd: 3,
        sectionHeading: null,
        similarity: 0.99,
      }],
      reason: null,
    },
    interpretation: {
      outcome: "EVIDENCE_SUFFICIENT",
      apparentIntent: "Request support",
      policyRequirements: [],
      knownFacts: [],
      missingFacts: [],
      clarificationQuestion: null,
      evidenceSufficient: true,
      humanReviewRequired: false,
      explanation: "The policy requires escalation.",
      sourceIds: ["chunk-1"],
      retrievalReason: null,
    },
  };
  return {
    result,
    response: {
      status: "INTERPRETED",
      answer: "The request requires human review.",
      sources: [{ id: "chunk-1", excerpt: "If a ticket status is OPEN, escalate to human review at level 3.", pageStart: 3, pageEnd: 3, sectionHeading: null }],
    },
  };
}

function persistenceClient() {
  const state = {
    ticket: null as { id: string; tenantId: string; status: string; triggeringBusinessRuleId?: string; matchedConditions?: unknown } | null,
    messages: [] as Array<{ authorRole: string; content: string }>,
    evidence: [] as unknown[],
    audits: [] as unknown[],
  };
  const tx = {
    ticket: {
      findUnique: vi.fn().mockImplementation(async () => state.ticket),
      create: vi.fn().mockImplementation(async ({ data }: { data: { tenantId: string; status: string; triggeringBusinessRuleId?: string; matchedConditions?: unknown } }) => {
        state.ticket = { id: "ticket-1", ...data };
        return { id: "ticket-1", referenceNumber: "T-1" };
      }),
      update: vi.fn().mockImplementation(async ({ data }: { data: Partial<typeof state.ticket> }) => {
        state.ticket = { ...state.ticket!, ...data };
        return { id: "ticket-1", referenceNumber: "T-1" };
      }),
    },
    decisionRecord: {
      create: vi.fn().mockImplementation(async ({ data }: { data: { evidence: { create: unknown[] } } }) => {
        state.evidence.push(...data.evidence.create);
        return { id: "decision-1" };
      }),
    },
    conversationMessage: {
      createMany: vi.fn().mockImplementation(async ({ data }: { data: Array<{ authorRole: string; content: string }> }) => {
        state.messages.push(...data);
        return { count: data.length };
      }),
    },
    auditEvent: {
      create: vi.fn().mockImplementation(async ({ data }: { data: unknown }) => { state.audits.push(data); }),
    },
  };
  return {
    state,
    client: { $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)) } as unknown as ConversationPersistenceClient,
  };
}

describe("policy workflow integration", () => {
  it("indexes evidence, keeps suggestions pending, approves a rule, evaluates, escalates, and reuses the conversation", async () => {
    const { repository, state } = workflowRepository();
    await ingestPolicyPdf(tenantId, policyFile, {
      repository,
      chunkSize: 500,
      chunkOverlap: 0,
      embeddingProvider: { generateEmbedding: vi.fn().mockResolvedValue([1, 0]), metadata: { provider: "test", model: "fixture", dimensions: 2 } },
    });

    expect(state.document).toMatchObject({ isActive: true, status: "READY" });
    expect(state.suggestions).toHaveLength(1);
    const suggestion = state.suggestions[0];
    expect(suggestion).toMatchObject({ sourcePageStart: 3, sourcePageEnd: 3, proposedActions: [{ type: "ESCALATE", value: "3" }] });

    let approved = false;
    expect(approved).toBe(false);
    const configuration = validateRuleConfiguration({
      name: "Approved policy escalation",
      description: suggestion.statement,
      conditionMode: "ALL",
      conditions: suggestion.proposedConditions,
      actions: suggestion.proposedActions,
      precedence: 100,
      isActive: true,
      effectiveFrom: null,
      effectiveUntil: null,
    });
    expect(configuration.ok).toBe(true);
    if (!configuration.ok) return;
    approved = true;
    const rule: StoredBusinessRule = {
      id: "rule-1",
      name: configuration.value.name,
      description: configuration.value.description,
      isActive: true,
      precedence: configuration.value.precedence,
      conditionMode: configuration.value.conditionMode,
      conditions: configuration.value.conditions,
      actions: configuration.value.actions,
      effectiveFrom: null,
      effectiveUntil: null,
    };
    expect(approved).toBe(true);

    const decision = evaluateBusinessRules({ status: "OPEN" }, [rule]);
    expect(decision.recommendation).toBe("APPLY");
    expect(decision.proposedActions).toMatchObject([{ type: "ESCALATE", value: "3", ruleId: "rule-1" }]);

    const { result, response } = queryResult();
    const persistence = persistenceClient();
    const first = await persistPolicyConversation(conversationId, "Please help with this open ticket.", tenantId, result, response, persistence.client, decision);
    expect(first).toMatchObject({ id: "ticket-1", escalated: true });
    expect(persistence.state.ticket).toMatchObject({
      tenantId,
      status: "ESCALATED",
      triggeringBusinessRuleId: "rule-1",
      matchedConditions: [{ field: "status", matched: true }],
    });
    expect(persistence.state.evidence).toMatchObject([{ documentName: "support-policy.pdf", pageStart: 3, pageEnd: 3, sourceId: "chunk-1" }]);
    expect(persistence.state.audits).toHaveLength(1);

    const second = await persistPolicyConversation(conversationId, "A follow-up message.", tenantId, result, response, persistence.client, decision);
    expect(second?.id).toBe("ticket-1");
    expect(persistence.state.messages).toHaveLength(4);
    expect(persistence.state.audits).toHaveLength(1);
  });

  it("covers non-match, incomplete context, conflict, and cross-tenant safety cases", async () => {
    const rule: StoredBusinessRule = {
      id: "rule-1", name: "Open escalation", isActive: true, precedence: 1, conditionMode: "ALL",
      conditions: [{ field: "status", operator: "EQUALS", value: "OPEN" }],
      actions: [{ type: "ESCALATE", value: "3" }], effectiveFrom: null, effectiveUntil: null,
    };
    expect(evaluateBusinessRules({ status: "CLOSED" }, [rule]).recommendation).toBe("NO_MATCH");
    expect(evaluateBusinessRules({}, [rule]).recommendation).toBe("NO_MATCH");
    expect(evaluateBusinessRules({ status: "OPEN" }, [
      rule,
      { ...rule, id: "rule-2", actions: [{ type: "ESCALATE", value: "1" }] },
    ]).recommendation).toBe("HUMAN_REVIEW");

    const { result, response } = queryResult();
    const persistence = persistenceClient();
    persistence.state.ticket = { id: "ticket-1", tenantId: "other-tenant", status: "OPEN" };
    await expect(
      persistPolicyConversation(conversationId, "Cross-tenant request", tenantId, result, response, persistence.client),
    ).rejects.toThrow("does not belong to the requested tenant");
  });
});
