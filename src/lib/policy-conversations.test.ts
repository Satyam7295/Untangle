import { describe, expect, it, vi } from "vitest";

import type { QueryAnalysisResult } from "./query-analysis";
import type { PolicyQueryResponse } from "./policy-query-response";
import { persistPolicyConversation, type ConversationPersistenceClient } from "./policy-conversations";

const conversationId = "11111111-1111-4111-8111-111111111111";
const response: PolicyQueryResponse = {
  status: "INTERPRETED",
  answer: "Manager approval is required.",
  sources: [{ id: "chunk-1", excerpt: "Manager approval is required.", pageStart: 2, pageEnd: 2, sectionHeading: "Leave" }],
};
const result: QueryAnalysisResult = {
  status: "INTERPRETED",
  retrieval: {
    found: true,
    policy: { id: "policy-1", title: "Leave", fileName: "leave.pdf" },
    excerpts: [{
      chunkId: "chunk-1",
      excerpt: "Manager approval is required.",
      chunkIndex: 0,
      pageStart: 2,
      pageEnd: 2,
      sectionHeading: "Leave",
      similarity: 0.91,
    }],
    reason: null,
  },
  interpretation: {
    outcome: "EVIDENCE_SUFFICIENT",
    apparentIntent: "Understand leave.",
    policyRequirements: [],
    knownFacts: [],
    missingFacts: [],
    clarificationQuestion: null,
    evidenceSufficient: true,
    humanReviewRequired: false,
    explanation: "Manager approval is required.",
    sourceIds: ["chunk-1"],
    retrievalReason: null,
  },
};

function makeClient(existing: { id: string } | null = null) {
  const tx = {
    ticket: {
      findUnique: vi.fn().mockResolvedValue(existing ? { tenantId: "tenant-a", ...existing } : null),
      create: vi.fn().mockResolvedValue({ id: existing?.id ?? "ticket-1", referenceNumber: "T-1" }),
      update: vi.fn().mockResolvedValue({ id: existing?.id ?? "ticket-1", referenceNumber: "T-1" }),
    },
    decisionRecord: { create: vi.fn().mockResolvedValue({ id: "decision-1" }) },
    conversationMessage: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
  };
  return {
    tx,
    client: { $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)) },
  };
}

describe("policy conversation persistence", () => {
  it("creates one ticket with ordered user and assistant messages and linked evidence", async () => {
    const { client, tx } = makeClient();
    await persistPolicyConversation(conversationId, "Can I take leave?", "tenant-a", result, response, client as unknown as ConversationPersistenceClient);

    expect(tx.ticket.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ conversationId, tenantId: "tenant-a", status: "OPEN" }),
    }));
    expect(tx.decisionRecord.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        outcome: "ROUTED",
        evidence: { create: [expect.objectContaining({ sourceId: "chunk-1", relevanceScore: 0.91 })] },
      }),
    }));
    expect(tx.conversationMessage.createMany).toHaveBeenCalledWith({
      data: [
        { ticketId: "ticket-1", authorRole: "USER", content: "Can I take leave?" },
        { ticketId: "ticket-1", authorRole: "ASSISTANT", content: "Manager approval is required." },
      ],
    });
  });

  it("reuses an existing ticket for subsequent messages", async () => {
    const { client, tx } = makeClient({ id: "existing-ticket" });
    await persistPolicyConversation(conversationId, "What about contractors?", "tenant-a", result, response, client as unknown as ConversationPersistenceClient);

    expect(tx.ticket.create).not.toHaveBeenCalled();
    expect(tx.ticket.update).toHaveBeenCalled();
    expect(tx.conversationMessage.createMany).toHaveBeenCalledWith({
      data: [
        { ticketId: "existing-ticket", authorRole: "USER", content: "What about contractors?" },
        { ticketId: "existing-ticket", authorRole: "ASSISTANT", content: "Manager approval is required." },
      ],
    });
  });

  it("rejects an existing conversation owned by another tenant", async () => {
    const { client, tx } = makeClient({ id: "existing-ticket" });
    tx.ticket.findUnique.mockResolvedValue({ id: "existing-ticket", tenantId: "tenant-b", status: "OPEN", triggeringBusinessRuleId: null });

    await expect(
      persistPolicyConversation(conversationId, "Cross-tenant request", "tenant-a", result, response, client as unknown as ConversationPersistenceClient),
    ).rejects.toThrow("does not belong to the requested tenant");
    expect(tx.ticket.update).not.toHaveBeenCalled();
    expect(tx.conversationMessage.createMany).not.toHaveBeenCalled();
  });

  it("marks only human-review results as escalated", async () => {
    const { client, tx } = makeClient();
    const reviewResult = {
      ...result,
      status: "HUMAN_REVIEW_REQUIRED",
      interpretation: { ...result.interpretation, outcome: "HUMAN_REVIEW_REQUIRED", humanReviewRequired: true },
    } as QueryAnalysisResult;

    await persistPolicyConversation(conversationId, "This needs review.", "tenant-a", reviewResult, response, client as unknown as ConversationPersistenceClient);

    expect(tx.ticket.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "ESCALATED", escalationLevel: 1 }),
    }));
    expect(tx.decisionRecord.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ outcome: "HUMAN_REVIEW", humanReviewRequired: true }),
    }));
  });

  it("does not leave partial records when the transaction fails", async () => {
    const client = { $transaction: vi.fn().mockRejectedValue(new Error("database unavailable")) };

    await expect(
      persistPolicyConversation(conversationId, "Question", "tenant-a", result, response, client as unknown as ConversationPersistenceClient),
    ).rejects.toThrow("database unavailable");
  });
});
