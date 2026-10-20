import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("./prisma", () => ({ prisma: { policyDocument: { findFirst: mocks.findFirst } } }));

import { retrievePolicyChunks } from "./policy-retrieval";

describe("policy retrieval repository", () => {
  it("searches only the authenticated tenant's active READY policy and chunks", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await retrievePolicyChunks(
      { tenantId: "tenant-a" },
      "policy question",
      { embeddingProvider: { generateEmbedding: vi.fn().mockResolvedValue([1, 0]) } },
    );

    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: "tenant-a", isActive: true, indexingStatus: "READY" },
      select: expect.objectContaining({
        chunks: expect.objectContaining({
          where: { tenantId: "tenant-a" },
        }),
      }),
    }));
  });
});
