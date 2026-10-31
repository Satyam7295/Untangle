import { describe, expect, it } from "vitest";

import { extractDocumentRuleSuggestions } from "./document-rule-suggestions";

describe("document rule suggestion extraction", () => {
  it("keeps explicit escalation statements and page attribution without activating them", () => {
    const suggestions = extractDocumentRuleSuggestions([{
      id: "chunk-1",
      chunkIndex: 0,
      content: "Escalate to human review at level 3 when status is OPEN.",
      pageStart: 4,
      pageEnd: 4,
      sectionHeading: "Escalation",
    }]);

    expect(suggestions).toEqual([expect.objectContaining({
      sourceChunkId: "chunk-1",
      sourcePageStart: 4,
      proposedConditions: [{ field: "status", operator: "EQUALS", value: "OPEN" }],
      proposedActions: [{ type: "ESCALATE", value: "3" }],
    })]);
  });

  it("does not invent a structured rule for an unstructured policy statement", () => {
    const suggestions = extractDocumentRuleSuggestions([{
      id: "chunk-2",
      chunkIndex: 1,
      content: "Escalation may be appropriate in exceptional circumstances.",
      pageStart: 9,
      pageEnd: 9,
      sectionHeading: null,
    }]);
    expect(suggestions[0]?.proposedConditions).toEqual([]);
    expect(suggestions[0]?.proposedActions).toEqual([]);
  });
});
