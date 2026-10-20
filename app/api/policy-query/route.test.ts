import { beforeEach, describe, expect, it, vi } from "vitest";

import type { QueryAnalysisResult } from "../../../src/lib/query-analysis";
import { responseForResult } from "../../../src/lib/policy-query-response";
import { POST } from "./route";

const { analyzePolicyQuery, getPolicyTenantId } = vi.hoisted(() => ({
  analyzePolicyQuery: vi.fn(),
  getPolicyTenantId: vi.fn(() => "tenant-a"),
}));

vi.mock("../../../src/lib/query-analysis", () => ({ analyzePolicyQuery }));
vi.mock("../../../src/lib/env", () => ({ getPolicyTenantId }));

function request(body: unknown): Request {
  return new Request("http://localhost/api/policy-query", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const success: QueryAnalysisResult = {
  status: "INTERPRETED",
  retrieval: {
    found: true,
    policy: { id: "policy-a", title: "Leave", fileName: "leave.pdf" },
    excerpts: [{
      chunkId: "chunk-a",
      excerpt: "Manager approval is required.",
      chunkIndex: 0,
      pageStart: 2,
      pageEnd: 2,
      sectionHeading: "Leave",
      similarity: 0.9,
    }, {
      chunkId: "chunk-b",
      excerpt: "Unrelated text.",
      chunkIndex: 1,
      pageStart: 3,
      pageEnd: 3,
      sectionHeading: "Other",
      similarity: 0.8,
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
    sourceIds: ["chunk-a"],
    retrievalReason: null,
  },
};

describe("policy query route", () => {
  beforeEach(() => {
    analyzePolicyQuery.mockReset();
    getPolicyTenantId.mockReset().mockReturnValue("tenant-a");
  });

  it("uses only the configured server tenant and returns validated sources", async () => {
    analyzePolicyQuery.mockResolvedValue(success);
    const response = await POST(request({ query: "  Can I take leave?  ", tenantId: "other-tenant" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "INTERPRETED",
      answer: "Manager approval is required.",
      sources: [{
        id: "chunk-a",
        excerpt: "Manager approval is required.",
        pageStart: 2,
        pageEnd: 2,
        sectionHeading: "Leave",
      }],
    });
    expect(getPolicyTenantId).toHaveBeenCalled();
    expect(analyzePolicyQuery).toHaveBeenCalledWith({
      query: "  Can I take leave?  ",
      tenantContext: { tenantId: "tenant-a" },
    });
  });

  it.each([
    { query: " ", status: "INVALID_QUERY", httpStatus: 400 },
    { query: "x".repeat(2_001), status: "INVALID_QUERY", httpStatus: 400 },
  ])("maps invalid queries to a client error", async ({ query, status, httpStatus }) => {
    analyzePolicyQuery.mockResolvedValue({ status, error: "safe validation message" });
    const response = await POST(request({ query }));
    expect(response.status).toBe(httpStatus);
    expect(await response.json()).toMatchObject({ status, answer: expect.any(String), sources: [] });
  });

  it("rejects an oversized request body before starting policy analysis", async () => {
    const response = await POST(new Request("http://localhost/api/policy-query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "x".repeat(17_000) }),
    }));

    expect(response.status).toBe(413);
    expect(analyzePolicyQuery).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({
      status: "REQUEST_ERROR",
      sources: [],
    });
  });

  it.each(["NO_ACTIVE_POLICY", "REINDEX_REQUIRED", "NO_USABLE_CHUNKS", "NO_RELEVANT_EVIDENCE"] as const)(
    "returns insufficient evidence for %s",
    async (status) => {
      analyzePolicyQuery.mockResolvedValue({
        status,
        retrieval: { found: false, policy: null, excerpts: [], reason: status },
      });
      const response = await POST(request({ query: "Question" }));
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        status,
        answer: expect.stringContaining("not find enough current policy evidence"),
        sources: [],
      });
    },
  );

  it("maps provider and timeout failures without leaking details", async () => {
    analyzePolicyQuery.mockResolvedValue({
      status: "GROQ_PROVIDER_ERROR",
      error: "private provider details",
    });
    const providerResponse = await POST(request({ query: "Question" }));
    expect(providerResponse.status).toBe(503);
    expect(JSON.stringify(await providerResponse.json())).not.toContain("private provider details");

    vi.useFakeTimers();
    analyzePolicyQuery.mockImplementation(() => new Promise(() => undefined));
    const timeoutPromise = POST(request({ query: "Question" }));
    await vi.advanceTimersByTimeAsync(35_000);
    const timeoutResponse = await timeoutPromise;
    expect(timeoutResponse.status).toBe(504);
    vi.useRealTimers();
  });

  it("returns configuration failure without exposing environment details", async () => {
    getPolicyTenantId.mockImplementation(() => {
      throw new Error("DATABASE_URL=private");
    });
    const response = await POST(request({ query: "Question" }));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("DATABASE_URL");
  });

  it("never trusts source IDs supplied by the browser", () => {
    const mapped = responseForResult(success);
    expect(mapped.sources.map((source) => source.id)).toEqual(["chunk-a"]);
  });
});
