import { getEmbeddingProvider, type EmbeddingProvider } from "./embedding-provider";
import { chunkPolicyPages, type PolicyChunk } from "./policy-chunking";
import {
  DEFAULT_MAX_POLICY_UPLOAD_BYTES,
  extractPolicyPages,
  validatePolicyUpload,
  type PolicyUpload,
} from "./policy-pdf";
import { prisma } from "./prisma";

export type PolicyIndexingStatus =
  | "UPLOADING" | "EXTRACTING" | "CHUNKING" | "EMBEDDING" | "READY" | "FAILED";

type IngestionRepository = {
  createDocument(data: {
    tenantId: string;
    fileName: string;
    title: string;
    sourceSizeBytes: number;
  }): Promise<{ id: string }>;
  updateStatus(id: string, status: PolicyIndexingStatus, data?: { pageCount?: number; failureReason?: string | null }): Promise<void>;
  replaceChunksAndActivate(
    id: string,
    tenantId: string,
    chunks: Array<PolicyChunk & { embedding: readonly number[] }>,
  ): Promise<void>;
};

const repository: IngestionRepository = {
  createDocument: (data) => prisma.policyDocument.create({ data, select: { id: true } }),
  updateStatus: (id, indexingStatus, data) => prisma.policyDocument.update({
    where: { id },
    data: { indexingStatus, ...data },
  }).then(() => undefined),
  replaceChunksAndActivate: (id, tenantId, chunks) => prisma.$transaction(async (transaction) => {
    await transaction.policyChunk.deleteMany({ where: { policyId: id, tenantId } });
    await transaction.policyChunk.createMany({
      data: chunks.map((chunk) => ({
        policyId: id,
        tenantId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        pageStart: chunk.pageStart,
        pageEnd: chunk.pageEnd,
        sectionHeading: chunk.sectionHeading,
        embedding: [...chunk.embedding],
      })),
    });
    await transaction.policyDocument.updateMany({
      where: { tenantId, isActive: true, id: { not: id } },
      data: { isActive: false },
    });
    await transaction.policyDocument.update({
      where: { id },
      data: { isActive: true, indexingStatus: "READY", failureReason: null },
    });
  }),
};

function getIntegerEnvironment(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export async function ingestPolicyPdf(
  tenantId: string,
  file: PolicyUpload,
  dependencies: {
    embeddingProvider?: EmbeddingProvider;
    repository?: IngestionRepository;
    maxUploadBytes?: number;
    chunkSize?: number;
    chunkOverlap?: number;
  } = {},
): Promise<{ id: string; chunkCount: number; pageCount: number }> {
  if (!tenantId.trim()) throw new Error("A trusted tenant ID is required.");
  validatePolicyUpload(file, dependencies.maxUploadBytes ?? getIntegerEnvironment(
    "POLICY_MAX_UPLOAD_BYTES",
    DEFAULT_MAX_POLICY_UPLOAD_BYTES,
  ));
  const activeRepository = dependencies.repository ?? repository;
  const document = await activeRepository.createDocument({
    tenantId,
    fileName: file.name,
    title: file.name.replace(/\.pdf$/i, ""),
    sourceSizeBytes: file.size,
  });

  try {
    await activeRepository.updateStatus(document.id, "EXTRACTING");
    const pages = await extractPolicyPages(new Uint8Array(await file.arrayBuffer()));
    await activeRepository.updateStatus(document.id, "CHUNKING", { pageCount: pages.length });
    const chunks = chunkPolicyPages(pages, {
      maxCharacters: dependencies.chunkSize ?? getIntegerEnvironment("POLICY_CHUNK_SIZE", 1800),
      overlapCharacters: dependencies.chunkOverlap ?? getIntegerEnvironment("POLICY_CHUNK_OVERLAP", 200),
    });
    if (chunks.length === 0) throw new Error("The PDF contains no usable policy text.");
    await activeRepository.updateStatus(document.id, "EMBEDDING");
    const provider = dependencies.embeddingProvider ?? getEmbeddingProvider();
    const embedded = [];
    let embeddingDimension: number | null = null;
    for (const chunk of chunks) {
      const embedding = await provider.generateEmbedding(chunk.content);
      if (embedding.length === 0 || !embedding.every((value) => Number.isFinite(value))) {
        throw new Error("Embedding provider returned an invalid vector.");
      }
      if (embeddingDimension === null) embeddingDimension = embedding.length;
      if (embedding.length !== embeddingDimension) {
        throw new Error("Embedding provider returned inconsistent vector dimensions.");
      }
      embedded.push({ ...chunk, embedding });
    }
    await activeRepository.replaceChunksAndActivate(document.id, tenantId, embedded);
    return { id: document.id, chunkCount: chunks.length, pageCount: pages.length };
  } catch (error) {
    await activeRepository.updateStatus(document.id, "FAILED", {
      failureReason: error instanceof Error ? error.message.slice(0, 500) : "Indexing failed.",
    });
    throw error;
  }
}

export type { IngestionRepository };
