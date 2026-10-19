import { describe, expect, it, vi } from "vitest";

import {
  cosineSimilarity,
  POLICY_QUERY_MAX_LENGTH,
  retrievePolicyChunks,
  type PolicyRepository,
  type StoredPolicy,
} from "./policy-retrieval";
import { createTrustedTenantContext } from "./policy-tenant";

const policy: StoredPolicy = {
  id: "policy-a",
  fileName: "employee-policy.pdf",
  title: "Employee policy",
  indexingStatus: "READY",
  chunks: [
    {
      id: "chunk-low",
      chunkIndex: 1,
      content: "Low relevance",
      pageStart: 2,
      pageEnd: 2,
      sectionHeading: "Other",
      embedding: [0, 1],
    },
    {
      id: "chunk-high",
      chunkIndex: 0,
      content: "High relevance",
      pageStart: 1,
      pageEnd: 1,
      sectionHeading: "Leave",
      embedding: [1, 0],
    },
  ],
};

function repositoryReturning(value: StoredPolicy | null): PolicyRepository {
  return { findActiveReadyPolicy: vi.fn().mockResolvedValue(value) };
}

describe("policy retrieval", () => {
  it("calculates cosine similarity and ranks relevant chunks", async () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);

    const result = await retrievePolicyChunks(
      createTrustedTenantContext("tenant-a"),
      "  leave policy  ",
      {
        embeddingProvider: { generateEmbedding: vi.fn().mockResolvedValue([1, 0]) },
        repository: repositoryReturning(policy),
        minSimilarity: 0,
      },
    );

    expect(result.found).toBe(true);
    expect(result.excerpts.map((chunk) => chunk.chunkId)).toEqual(["chunk-high", "chunk-low"]);
    expect(result.excerpts[0]).toMatchObject({
      pageStart: 1,
      pageEnd: 1,
      sectionHeading: "Leave",
      similarity: 1,
    });
    expect(result.policy).toEqual({
      id: "policy-a",
      title: "Employee policy",
      fileName: "employee-policy.pdf",
    });
  });

  it("returns no evidence when there is no active policy or no chunks", async () => {
    const provider = { generateEmbedding: vi.fn().mockResolvedValue([1, 0]) };
    await expect(
      retrievePolicyChunks(createTrustedTenantContext("tenant-a"), "query", {
        embeddingProvider: provider,
        repository: repositoryReturning(null),
      }),
    ).resolves.toMatchObject({ found: false, reason: "NO_ACTIVE_POLICY" });

    await expect(
      retrievePolicyChunks(createTrustedTenantContext("tenant-a"), "query", {
        embeddingProvider: provider,
        repository: repositoryReturning({ ...policy, chunks: [] }),
      }),
    ).resolves.toMatchObject({ found: false, reason: "NO_USABLE_CHUNKS" });
  });

  it("filters below-threshold, malformed, non-finite, and wrong-dimension vectors", async () => {
    const result = await retrievePolicyChunks(
      createTrustedTenantContext("tenant-a"),
      "query",
      {
        embeddingProvider: { generateEmbedding: vi.fn().mockResolvedValue([1, 0]) },
        repository: repositoryReturning({
          ...policy,
          chunks: [
            { ...policy.chunks[0], embedding: [1] },
            { ...policy.chunks[0], id: "nan", embedding: [Number.NaN, 0] },
            { ...policy.chunks[0], id: "valid", embedding: [0.8, 0.6] },
          ],
        }),
        minSimilarity: 0.95,
      },
    );

    expect(result).toMatchObject({ found: false, reason: "NO_RELEVANT_EVIDENCE" });
    expect(result.excerpts).toEqual([]);
  });

  it("uses only the server-resolved tenant and active READY policy repository query", async () => {
    const repository = repositoryReturning(policy);
    await retrievePolicyChunks(createTrustedTenantContext("tenant-a"), "query", {
      embeddingProvider: { generateEmbedding: vi.fn().mockResolvedValue([1, 0]) },
      repository,
      minSimilarity: 0,
    });

    expect(repository.findActiveReadyPolicy).toHaveBeenCalledWith("tenant-a");
  });

  it("does not mix a stored vector with a different embedding model", async () => {
    const result = await retrievePolicyChunks(
      createTrustedTenantContext("tenant-a"),
      "query",
      {
        embeddingProvider: {
          generateEmbedding: vi.fn().mockResolvedValue([1, 0]),
          metadata: { provider: "cloudflare", model: "new-model", dimensions: 2 },
        },
        repository: repositoryReturning({
          ...policy,
          embeddingProvider: "cloudflare",
          embeddingModel: "old-model",
          embeddingDimensions: 2,
        }),
      },
    );

    expect(result).toEqual({
      found: false,
      policy: null,
      excerpts: [],
      reason: "REINDEX_REQUIRED",
    });
  });

  it("respects topK and validates query/options", async () => {
    const provider = { generateEmbedding: vi.fn().mockResolvedValue([1, 0]) };
    const options = { embeddingProvider: provider, repository: repositoryReturning(policy), topK: 1, minSimilarity: 0 };
    const result = await retrievePolicyChunks(createTrustedTenantContext("tenant-a"), "query", options);
    expect(result.excerpts).toHaveLength(1);

    await expect(retrievePolicyChunks(createTrustedTenantContext("tenant-a"), "   ", options)).rejects.toThrow("cannot be empty");
    await expect(retrievePolicyChunks(createTrustedTenantContext("tenant-a"), "x".repeat(POLICY_QUERY_MAX_LENGTH + 1), options)).rejects.toThrow("cannot exceed");
    await expect(retrievePolicyChunks(createTrustedTenantContext("tenant-a"), "query", { ...options, topK: 0 })).rejects.toThrow("topK");
  });

  it("propagates embedding and database failures", async () => {
    const embeddingFailure = new Error("provider unavailable");
    await expect(
      retrievePolicyChunks(createTrustedTenantContext("tenant-a"), "query", {
        embeddingProvider: { generateEmbedding: vi.fn().mockRejectedValue(embeddingFailure) },
        repository: repositoryReturning(policy),
      }),
    ).rejects.toThrow("provider unavailable");

    const databaseFailure = new Error("database unavailable");
    await expect(
      retrievePolicyChunks(createTrustedTenantContext("tenant-a"), "query", {
        embeddingProvider: { generateEmbedding: vi.fn().mockResolvedValue([1, 0]) },
        repository: { findActiveReadyPolicy: vi.fn().mockRejectedValue(databaseFailure) },
      }),
    ).rejects.toThrow("database unavailable");
  });
});
