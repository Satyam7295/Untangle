import type { GroqProvider } from "./groq-provider";
import {
  interpretPolicy,
  type ConversationFacts,
  type PolicyInterpretationResult,
} from "./policy-interpretation";
import {
  POLICY_QUERY_MAX_LENGTH,
  retrievePolicyChunks,
  type PolicyRepository,
  type PolicyRetrievalOptions,
  type PolicyRetrievalResult,
} from "./policy-retrieval";
import type { AuthenticatedTenantContext } from "./policy-tenant";
import type { EmbeddingProvider } from "./embedding-provider";

export type QueryAnalysisInput = {
  query: string;
  tenantContext: AuthenticatedTenantContext;
  conversationFacts?: ConversationFacts;
};

export type QueryAnalysisSuccess = {
  status: "INTERPRETED" | "CLARIFICATION_NEEDED" | "HUMAN_REVIEW_REQUIRED";
  retrieval: PolicyRetrievalResult;
  interpretation: PolicyInterpretationResult;
};

export type QueryAnalysisNoResult = {
  status: "NO_ACTIVE_POLICY" | "NO_USABLE_CHUNKS" | "NO_RELEVANT_EVIDENCE";
  retrieval: PolicyRetrievalResult;
};

export type QueryAnalysisError = {
  status:
    | "INVALID_QUERY"
    | "EMBEDDING_PROVIDER_ERROR"
    | "RETRIEVAL_DATABASE_ERROR"
    | "GROQ_PROVIDER_ERROR";
  error: string;
};

export type QueryAnalysisResult =
  | QueryAnalysisSuccess
  | QueryAnalysisNoResult
  | QueryAnalysisError;

export type QueryAnalysisDependencies = {
  retrieve?: (
    context: AuthenticatedTenantContext,
    query: string,
    options?: PolicyRetrievalOptions,
  ) => Promise<PolicyRetrievalResult>;
  interpret?: (
    input: Parameters<typeof interpretPolicy>[0],
    provider?: GroqProvider,
  ) => Promise<PolicyInterpretationResult>;
  embeddingProvider?: EmbeddingProvider;
  repository?: PolicyRepository;
  groqProvider?: GroqProvider;
};

function normalizeQuery(query: unknown): string | null {
  if (typeof query !== "string") return null;
  const normalized = query.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > POLICY_QUERY_MAX_LENGTH) return null;
  return normalized;
}

function hasTrustedTenantContext(value: unknown): value is AuthenticatedTenantContext {
  return Boolean(
    value
    && typeof value === "object"
    && typeof (value as AuthenticatedTenantContext).tenantId === "string"
    && (value as AuthenticatedTenantContext).tenantId.trim(),
  );
}

function isEmbeddingConfigurationError(error: unknown): boolean {
  return error instanceof Error
    && /no embedding provider is configured|embedding provider.*configur/i.test(error.message);
}

function isDatabaseError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: unknown; code?: unknown };
  return candidate.name === "PrismaClientKnownRequestError"
    || candidate.name === "PrismaClientInitializationError"
    || (typeof candidate.code === "string" && /^P\d{4}$/.test(candidate.code));
}

function retrievalError(error: unknown): QueryAnalysisError {
  if (isEmbeddingConfigurationError(error)) {
    return {
      status: "EMBEDDING_PROVIDER_ERROR",
      error: "Policy search is not configured. Please contact support.",
    };
  }
  if (isDatabaseError(error)) {
    return {
      status: "RETRIEVAL_DATABASE_ERROR",
      error: "Policy search is temporarily unavailable. Please try again later.",
    };
  }
  return {
    status: "RETRIEVAL_DATABASE_ERROR",
    error: "Policy search is temporarily unavailable. Please try again later.",
  };
}

export async function analyzePolicyQuery(
  input: QueryAnalysisInput,
  dependencies: QueryAnalysisDependencies = {},
): Promise<QueryAnalysisResult> {
  const query = normalizeQuery(input?.query);
  if (!query) {
    return {
      status: "INVALID_QUERY",
      error: `Enter a query between 1 and ${POLICY_QUERY_MAX_LENGTH} characters.`,
    };
  }
  if (!hasTrustedTenantContext(input?.tenantContext)) {
    return {
      status: "INVALID_QUERY",
      error: "A trusted server-resolved tenant context is required.",
    };
  }

  const retrieve = dependencies.retrieve ?? retrievePolicyChunks;
  let retrieval: PolicyRetrievalResult;
  try {
    retrieval = await retrieve(input.tenantContext, query, {
      ...(dependencies.embeddingProvider ? { embeddingProvider: dependencies.embeddingProvider } : {}),
      ...(dependencies.repository ? { repository: dependencies.repository } : {}),
    });
  } catch (error) {
    if (isEmbeddingConfigurationError(error) || (error instanceof Error && /embedding/i.test(error.message))) {
      return {
        status: "EMBEDDING_PROVIDER_ERROR",
        error: "Policy search is temporarily unavailable. Please try again later.",
      };
    }
    return retrievalError(error);
  }

  if (!retrieval.found || retrieval.excerpts.length === 0) {
    const reason = retrieval.reason ?? "NO_RELEVANT_EVIDENCE";
    return { status: reason, retrieval };
  }

  try {
    const interpret = dependencies.interpret ?? interpretPolicy;
    const interpretation = await interpret({
      query,
      conversationFacts: input.conversationFacts,
      retrieval,
    }, dependencies.groqProvider);
    return {
      status: interpretation.outcome === "NEEDS_CLARIFICATION"
        ? "CLARIFICATION_NEEDED"
        : interpretation.outcome === "HUMAN_REVIEW_REQUIRED"
          ? "HUMAN_REVIEW_REQUIRED"
          : "INTERPRETED",
      retrieval,
      interpretation,
    };
  } catch {
    return {
      status: "GROQ_PROVIDER_ERROR",
      error: "Policy interpretation is temporarily unavailable. Please try again later.",
    };
  }
}
