import type { QueryAnalysisResult } from "./query-analysis";
import type { RetrievedPolicyExcerpt } from "./policy-retrieval";

export type PolicyQuerySource = {
  id: string;
  excerpt: string;
  pageStart: number | null;
  pageEnd: number | null;
  sectionHeading: string | null;
};

export type PolicyQueryResponse = {
  status: QueryAnalysisResult["status"];
  answer: string;
  clarificationQuestion?: string;
  sources: PolicyQuerySource[];
};

function sourceReferences(
  excerpts: RetrievedPolicyExcerpt[],
  sourceIds: readonly string[],
): PolicyQuerySource[] {
  const allowedIds = new Set(sourceIds);
  return excerpts
    .filter((excerpt) => allowedIds.has(excerpt.chunkId))
    .map((excerpt) => ({
      id: excerpt.chunkId,
      excerpt: excerpt.excerpt,
      pageStart: excerpt.pageStart,
      pageEnd: excerpt.pageEnd,
      sectionHeading: excerpt.sectionHeading,
    }));
}

export function responseForResult(result: QueryAnalysisResult): PolicyQueryResponse {
  if ("error" in result) {
    const answer = result.status === "INVALID_QUERY"
      ? "Enter a query between 1 and 2,000 characters."
      : result.status === "EMBEDDING_PROVIDER_ERROR"
        ? "Policy search is temporarily unavailable. Please try again later."
        : result.status === "GROQ_PROVIDER_ERROR"
          ? "Policy interpretation is temporarily unavailable. Please try again later."
          : "Policy search is temporarily unavailable. Please try again later.";
    return { status: result.status, answer, sources: [] };
  }

  if ("interpretation" in result) {
    const interpretation = result.interpretation;
    return {
      status: result.status,
      answer: interpretation.explanation,
      ...(interpretation.clarificationQuestion
        ? { clarificationQuestion: interpretation.clarificationQuestion }
        : {}),
      sources: sourceReferences(result.retrieval.excerpts, interpretation.sourceIds),
    };
  }

  return {
    status: result.status,
    answer: "I could not find enough current policy evidence to answer safely. Please contact support for human review.",
    sources: [],
  };
}

export { sourceReferences };
