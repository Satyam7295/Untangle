import { prisma } from "./prisma";
import { getEmbeddingProvider, type EmbeddingProvider } from "./embedding-provider";
import type { AuthenticatedTenantContext } from "./policy-tenant";

export const POLICY_QUERY_MAX_LENGTH = 2_000;
export const DEFAULT_POLICY_RETRIEVAL_TOP_K = 5;
export const DEFAULT_POLICY_RETRIEVAL_MIN_SIMILARITY = 0.35;

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type StoredChunk = {
  id: string;
  chunkIndex: number;
  content: string;
  pageStart: number | null;
  pageEnd: number | null;
  sectionHeading: string | null;
  embedding: JsonValue | null;
};

type StoredPolicy = {
  id: string;
  fileName: string;
  title: string | null;
  indexingStatus: string;
  chunks: StoredChunk[];
};

type PolicyRepository = {
  findActiveReadyPolicy(tenantId: string): Promise<StoredPolicy | null>;
};

const policyRepository: PolicyRepository = {
  findActiveReadyPolicy(tenantId) {
    return prisma.policyDocument.findFirst({
      where: { tenantId, isActive: true, indexingStatus: "READY" },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        fileName: true,
        title: true,
        indexingStatus: true,
        chunks: {
          where: { tenantId },
          orderBy: { chunkIndex: "asc" },
          select: {
            id: true,
            chunkIndex: true,
            content: true,
            pageStart: true,
            pageEnd: true,
            sectionHeading: true,
            embedding: true,
          },
        },
      },
    }) as Promise<StoredPolicy | null>;
  },
};

export type PolicyRetrievalOptions = {
  topK?: number;
  minSimilarity?: number;
  embeddingProvider?: EmbeddingProvider;
  repository?: PolicyRepository;
};

export type RetrievedPolicyExcerpt = {
  chunkId: string;
  excerpt: string;
  chunkIndex: number;
  pageStart: number | null;
  pageEnd: number | null;
  sectionHeading: string | null;
  similarity: number;
};

export type PolicyRetrievalResult = {
  found: boolean;
  policy: {
    id: string;
    title: string | null;
    fileName: string;
  } | null;
  excerpts: RetrievedPolicyExcerpt[];
  reason:
    | "NO_ACTIVE_POLICY"
    | "NO_USABLE_CHUNKS"
    | "NO_RELEVANT_EVIDENCE"
    | null;
};

function normalizeQuery(query: string): string {
  if (typeof query !== "string") {
    throw new Error("Policy retrieval query must be a string.");
  }

  const normalized = query.trim().replace(/\s+/g, " ");
  if (!normalized) throw new Error("Policy retrieval query cannot be empty.");
  if (normalized.length > POLICY_QUERY_MAX_LENGTH) {
    throw new Error(`Policy retrieval query cannot exceed ${POLICY_QUERY_MAX_LENGTH} characters.`);
  }
  return normalized;
}

function readFiniteVector(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (!value.every((item): item is number => typeof item === "number" && Number.isFinite(item))) {
    return null;
  }
  return value;
}

export function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  if (left.length === 0 || left.length !== right.length) return Number.NaN;
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }
  if (leftMagnitude === 0 || rightMagnitude === 0) return Number.NaN;
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function validateOptions(options: PolicyRetrievalOptions): { topK: number; minSimilarity: number } {
  const topK = options.topK ?? DEFAULT_POLICY_RETRIEVAL_TOP_K;
  const minSimilarity = options.minSimilarity ?? DEFAULT_POLICY_RETRIEVAL_MIN_SIMILARITY;
  if (!Number.isInteger(topK) || topK < 1 || topK > 50) {
    throw new Error("Policy retrieval topK must be an integer between 1 and 50.");
  }
  if (!Number.isFinite(minSimilarity) || minSimilarity < -1 || minSimilarity > 1) {
    throw new Error("Policy retrieval minSimilarity must be between -1 and 1.");
  }
  return { topK, minSimilarity };
}

export async function retrievePolicyChunks(
  context: AuthenticatedTenantContext,
  query: string,
  options: PolicyRetrievalOptions = {},
): Promise<PolicyRetrievalResult> {
  if (!context || typeof context.tenantId !== "string" || !context.tenantId.trim()) {
    throw new Error("A server-resolved authenticated tenant context is required.");
  }
  const normalizedQuery = normalizeQuery(query);
  const { topK, minSimilarity } = validateOptions(options);
  const provider = options.embeddingProvider ?? getEmbeddingProvider();
  const queryVector = readFiniteVector(await provider.generateEmbedding(normalizedQuery));
  if (!queryVector) throw new Error("Embedding provider returned an invalid vector.");

  const policy = await (options.repository ?? policyRepository).findActiveReadyPolicy(context.tenantId);
  if (!policy) {
    return { found: false, policy: null, excerpts: [], reason: "NO_ACTIVE_POLICY" };
  }

  const scored = policy.chunks.flatMap((chunk) => {
    const vector = readFiniteVector(chunk.embedding);
    if (!vector || vector.length !== queryVector.length) return [];
    const similarity = cosineSimilarity(queryVector, vector);
    if (!Number.isFinite(similarity) || similarity < minSimilarity) return [];
    return [{
      chunkId: chunk.id,
      excerpt: chunk.content,
      chunkIndex: chunk.chunkIndex,
      pageStart: chunk.pageStart,
      pageEnd: chunk.pageEnd,
      sectionHeading: chunk.sectionHeading,
      similarity,
    }];
  });

  scored.sort((left, right) => right.similarity - left.similarity || left.chunkIndex - right.chunkIndex);
  const excerpts = scored.slice(0, topK);
  return {
    found: excerpts.length > 0,
    policy: { id: policy.id, title: policy.title, fileName: policy.fileName },
    excerpts,
    reason: excerpts.length > 0
      ? null
      : policy.chunks.length > 0 ? "NO_RELEVANT_EVIDENCE" : "NO_USABLE_CHUNKS",
  };
}

export type { PolicyRepository, StoredChunk, StoredPolicy };
