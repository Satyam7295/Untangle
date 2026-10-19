import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  prisma: {
    policyDocument: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    policyChunk: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("./prisma", () => mockPrisma);
vi.mock("pdf-parse", () => ({
  PDFParse: class {
    async getText() {
      return { pages: [{ num: 4, text: "Refund policy\n\nRefunds are available." }] };
    }
    async destroy() {}
  },
}));

import { createAndIndexPolicy, indexPolicyDocument } from "./policy-pipeline";

const document = {
  id: "document-1",
  tenantId: "tenant-a",
  storageKey: "document-1.pdf",
  status: "FAILED" as const,
  isActive: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.prisma.policyDocument.findFirst.mockResolvedValue(document);
  mockPrisma.prisma.policyDocument.update.mockResolvedValue(document);
  mockPrisma.prisma.policyDocument.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.prisma.$transaction.mockImplementation(async (callback) =>
    callback({
      policyChunk: {
        deleteMany: mockPrisma.prisma.policyChunk.deleteMany,
        create: mockPrisma.prisma.policyChunk.create,
      },
      policyDocument: {
        update: mockPrisma.prisma.policyDocument.update,
        updateMany: mockPrisma.prisma.policyDocument.updateMany,
      },
    }),
  );
});

describe("policy indexing lifecycle", () => {
  it("scopes lookup to the authorized tenant and activates only after indexing", async () => {
    const result = await indexPolicyDocument("tenant-a", "document-1", {
      readFile: async () => Buffer.from("%PDF-1.7"),
      embed: async () => [0.1, 0.2],
    });

    expect(result.status).toBe("READY");
    expect(mockPrisma.prisma.policyDocument.findFirst).toHaveBeenCalledWith({
      where: { id: "document-1", tenantId: "tenant-a" },
    });
    expect(mockPrisma.prisma.policyChunk.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: "tenant-a", pageStart: 4 }) }),
    );
    expect(mockPrisma.prisma.$transaction).toHaveBeenCalled();
    expect(mockPrisma.prisma.policyDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isActive: true }) }),
    );
  });

  it("marks embedding failures as failed and does not activate the document", async () => {
    const result = await indexPolicyDocument("tenant-a", "document-1", {
      readFile: async () => Buffer.from("%PDF-1.7"),
      embed: async () => {
        throw new Error("provider unavailable");
      },
    });

    expect(result.status).toBe("FAILED");
    expect(result.message).toContain("provider unavailable");
    expect(mockPrisma.prisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.prisma.policyDocument.update).toHaveBeenLastCalledWith({
      where: { id: "document-1", tenantId: "tenant-a" },
      data: expect.objectContaining({ status: "FAILED", isActive: false }),
    });
  });

  it("marks database persistence failures as failed", async () => {
    mockPrisma.prisma.$transaction.mockRejectedValue(new Error("database unavailable"));
    const result = await indexPolicyDocument("tenant-a", "document-1", {
      readFile: async () => Buffer.from("%PDF-1.7"),
      embed: async () => [0.1],
    });

    expect(result.status).toBe("FAILED");
    expect(result.message).toContain("database unavailable");
    expect(mockPrisma.prisma.policyDocument.update).toHaveBeenLastCalledWith({
      where: { id: "document-1", tenantId: "tenant-a" },
      data: expect.objectContaining({ status: "FAILED" }),
    });
  });

  it("does not create a duplicate while the same document is processing", async () => {
    mockPrisma.prisma.policyDocument.findFirst.mockResolvedValue({
      ...document,
      status: "PROCESSING",
    });
    const result = await createAndIndexPolicy(
      "tenant-a",
      "policy.pdf",
      "application/pdf",
      Buffer.from("%PDF-1.7"),
      { saveFile: async () => "document-1.pdf" },
    );

    expect(result.status).toBe("PROCESSING");
    expect(mockPrisma.prisma.policyDocument.create).not.toHaveBeenCalled();
  });
});
