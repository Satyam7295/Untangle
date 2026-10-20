import { describe, expect, it, vi } from "vitest";

const pdfMocks = vi.hoisted(() => ({
  getText: vi.fn(),
  destroy: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("pdf-parse", () => ({ PDFParse: vi.fn(() => pdfMocks) }));

import { ingestPolicyPdf, type IngestionRepository } from "./policy-ingestion";

const file = {
  name: "leave-policy.pdf",
  type: "application/pdf",
  size: 120,
  arrayBuffer: async () => new TextEncoder().encode("%PDF-1.7").buffer,
};

function fakeRepository() {
  const statuses: string[] = [];
  const repository: IngestionRepository = {
    createDocument: vi.fn().mockResolvedValue({ id: "policy-1" }),
    updateStatus: vi.fn().mockImplementation(async (_id, status) => statuses.push(status)),
    replaceChunksAndActivate: vi.fn().mockResolvedValue(undefined),
  };
  return { repository, statuses };
}

describe("policy ingestion", () => {
  it("persists embeddings before activating a policy", async () => {
    pdfMocks.getText.mockResolvedValueOnce({ pages: [{ num: 1, text: "Leave policy\nApproval required." }] });
    const { repository, statuses } = fakeRepository();
    const result = await ingestPolicyPdf("tenant-a", file, {
      repository,
      chunkSize: 200,
      chunkOverlap: 0,
      embeddingProvider: {
        generateEmbedding: vi.fn().mockResolvedValue([1, 0]),
        metadata: { provider: "cloudflare", model: "model", dimensions: 2 },
      },
    });
    expect(result).toMatchObject({ id: "policy-1", chunkCount: 1, pageCount: 1 });
    expect(statuses).toEqual(["EXTRACTING", "CHUNKING", "EMBEDDING"]);
    expect(repository.replaceChunksAndActivate).toHaveBeenCalledWith(
      "policy-1",
      "tenant-a",
      [expect.objectContaining({ embedding: [1, 0], pageStart: 1 })],
      { provider: "cloudflare", model: "model", dimensions: 2 },
    );
  });

  it("marks indexing FAILED and never activates when embedding fails", async () => {
    pdfMocks.getText.mockResolvedValueOnce({ pages: [{ num: 1, text: "Policy text" }] });
    const { repository, statuses } = fakeRepository();
    await expect(ingestPolicyPdf("tenant-b", file, {
      repository,
      chunkSize: 200,
      chunkOverlap: 0,
      embeddingProvider: { generateEmbedding: vi.fn().mockRejectedValue(new Error("provider unavailable")) },
    })).rejects.toThrow("provider unavailable");
    expect(statuses.at(-1)).toBe("FAILED");
    expect(repository.replaceChunksAndActivate).not.toHaveBeenCalled();
    expect(repository.updateStatus).toHaveBeenLastCalledWith(
      "policy-1",
      "FAILED",
      { failureReason: "provider unavailable" },
    );
  });

  it("rejects invalid embedding vectors before persistence", async () => {
    pdfMocks.getText.mockResolvedValueOnce({ pages: [{ num: 1, text: "Policy text" }] });
    const { repository } = fakeRepository();
    await expect(ingestPolicyPdf("tenant-c", file, {
      repository,
      chunkSize: 200,
      chunkOverlap: 0,
      embeddingProvider: { generateEmbedding: vi.fn().mockResolvedValue([Number.NaN]) },
    })).rejects.toThrow("invalid vector");
    expect(repository.replaceChunksAndActivate).not.toHaveBeenCalled();
  });

  it("requires a trusted tenant identifier", async () => {
    await expect(ingestPolicyPdf("   ", file)).rejects.toThrow("trusted tenant");
  });
});
