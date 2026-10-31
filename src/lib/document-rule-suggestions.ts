import type { PolicyChunk } from "./policy-chunking";
import type { RuleAction, RuleCondition } from "./configuration-validation";

export type DocumentRuleSuggestion = {
  sourceChunkId: string;
  sourcePageStart: number | null;
  sourcePageEnd: number | null;
  statement: string;
  proposedConditions: RuleCondition[];
  proposedActions: RuleAction[];
};

const escalationPattern = /\b(?:escalat(?:e|ion)|human review|required review)\b/i;
const levelPattern = /\b(?:level|priority)\s*(\d+)\b/i;
const statusPattern = /\bstatus\s*(?:is|=|:)\s*(open|in_progress|resolved|closed|escalated)\b/i;

export function extractDocumentRuleSuggestions(
  chunks: readonly (Omit<PolicyChunk, "pageStart" | "pageEnd"> & {
    id: string;
    pageStart: number | null;
    pageEnd: number | null;
  })[],
): DocumentRuleSuggestion[] {
  return chunks.flatMap((chunk) => {
    if (!escalationPattern.test(chunk.content)) return [];
    const status = chunk.content.match(statusPattern)?.[1]?.toUpperCase() as RuleCondition["value"] | undefined;
    const level = chunk.content.match(levelPattern)?.[1];
    return [{
      sourceChunkId: chunk.id,
      sourcePageStart: chunk.pageStart,
      sourcePageEnd: chunk.pageEnd,
      statement: chunk.content.slice(0, 2000),
      proposedConditions: status ? [{ field: "status", operator: "EQUALS", value: status }] : [],
      proposedActions: level ? [{ type: "ESCALATE", value: level }] : [],
    }];
  });
}
