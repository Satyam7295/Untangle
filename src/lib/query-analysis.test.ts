import { describe, expect, it, vi } from "vitest";

import { GroqProviderError } from "./groq-provider";
import { analyzePolicyQuery } from "./query-analysis";
import { createTrustedTenantContext } from "./policy-tenant";
import type { PolicyRetrievalResult } from "./policy-retrieval";

const context = createTrustedTenantContext("tenant-a");
const retrieval: PolicyRetrievalResult = {
  found: true,
  policy: { id: "policy-a", title: "Leave", fileName: "leave.pdf" },
  excerpts: [{
    chunkId: "chunk-a",
    excerpt: "Manager approval is required.",
    chunkIndex: 0,
    pageStart: 1,
    pageEnd: 1,
    sectionHeading: "Leave",
    similarity: 0.9,
  }],
  reason: null,
};
const interpretation = {
  outcome: "EVIDENCE_SUFFICIENT" as const,
  apparentIntent: "Understand leave.",
  policyRequirements: [],
  knownFacts: [],
  missingFacts: [],
  clarificationQuestion: null,
  evidenceSufficient: true,
  humanReviewRequired: false,
  explanation: "The evidence answers the question.",
  sourceIds: ["chunk-a"],
  retrievalReason: null,
};

const noEvidence = (reason: NonNullable<PolicyRetrievalResult["reason"]>): PolicyRetrievalResult => ({
  found: false,
  policy: reason === "NO_ACTIVE_POLICY" ? null : retrieval.policy,
  excerpts: [],
  reason,
});

describe("query analysis", () => {
  it("retrieves with the trusted context and interprets relevant evidence", async () => {
    const retrieve = vi.fn().mockResolvedValue(retrieval);
    const interpret = vi.fn().mockResolvedValue(interpretation);
    const result = await analyzePolicyQuery(
      { query: "  Can I take leave? ", tenantContext: context, conversationFacts: { employeeType: "staff" } },
      { retrieve, interpret },
    );

    expect(result).toMatchObject({ status: "INTERPRETED", interpretation });
    expect(retrieve).toHaveBeenCalledWith(context, "Can I take leave?", {});
    expect(interpret).toHaveBeenCalledWith(expect.objectContaining({
      query: "Can I take leave?",
      retrieval,
      conversationFacts: { employeeType: "staff" },
    }), undefined);
  });

  it.each(["NO_ACTIVE_POLICY", "NO_USABLE_CHUNKS", "NO_RELEVANT_EVIDENCE"] as const)(
    "preserves %s without invoking interpretation",
    async (reason) => {
      const interpret = vi.fn();
      const result = await analyzePolicyQuery(
        { query: "Question", tenantContext: context },
        { retrieve: vi.fn().mockResolvedValue(noEvidence(reason)), interpret },
      );
      expect(result).toMatchObject({ status: reason, retrieval: { reason } });
      expect(interpret).not.toHaveBeenCalled();
    },
  );

  it("distinguishes embedding configuration and database failures", async () => {
    await expect(analyzePolicyQuery(
      { query: "Question", tenantContext: context },
      { retrieve: vi.fn().mockRejectedValue(new Error("No embedding provider is configured.")) },
    )).resolves.toMatchObject({ status: "EMBEDDING_PROVIDER_ERROR" });

    const databaseError = Object.assign(new Error("secret database details"), {
      name: "PrismaClientKnownRequestError",
      code: "P2025",
    });
    const result = await analyzePolicyQuery(
      { query: "Question", tenantContext: context },
      { retrieve: vi.fn().mockRejectedValue(databaseError) },
    );
    expect(result).toMatchObject({ status: "RETRIEVAL_DATABASE_ERROR" });
    expect(JSON.stringify(result)).not.toContain("secret database details");

    await expect(analyzePolicyQuery(
      { query: "Question", tenantContext: context },
      { retrieve: vi.fn().mockRejectedValue(new Error("database unavailable")) },
    )).resolves.toMatchObject({ status: "RETRIEVAL_DATABASE_ERROR" });
  });

  it("handles Groq failures and invalid interpretation output safely", async () => {
    const providerFailure = await analyzePolicyQuery(
      { query: "Question", tenantContext: context },
      { retrieve: vi.fn().mockResolvedValue(retrieval), interpret: vi.fn().mockRejectedValue(
        new GroqProviderError("NETWORK_ERROR", "secret provider details"),
      ) },
    );
    expect(providerFailure).toMatchObject({ status: "GROQ_PROVIDER_ERROR" });
    expect(JSON.stringify(providerFailure)).not.toContain("secret provider details");

    const invalid = await analyzePolicyQuery(
      { query: "Question", tenantContext: context },
      {
        retrieve: vi.fn().mockResolvedValue(retrieval),
        groqProvider: { completeStructured: vi.fn().mockResolvedValue({ outcome: "invalid" }) },
      },
    );
    expect(invalid).toMatchObject({ status: "HUMAN_REVIEW_REQUIRED" });
  });

  it("rejects invalid queries before retrieval", async () => {
    const retrieve = vi.fn();
    await expect(analyzePolicyQuery(
      { query: " ".repeat(3), tenantContext: context },
      { retrieve },
    )).resolves.toMatchObject({ status: "INVALID_QUERY" });
    await expect(analyzePolicyQuery(
      { query: "x".repeat(2_001), tenantContext: context },
      { retrieve },
    )).resolves.toMatchObject({ status: "INVALID_QUERY" });
    expect(retrieve).not.toHaveBeenCalled();
  });
});
