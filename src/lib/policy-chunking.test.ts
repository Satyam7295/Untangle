import { describe, expect, it } from "vitest";

import { chunkPolicyPages } from "./policy-chunking";

describe("policy chunking", () => {
  it("keeps page metadata and creates overlapping bounded chunks", () => {
    const chunks = chunkPolicyPages(
      [{ pageNumber: 3, text: "Leave policy\n" + "approval ".repeat(80) }],
      { maxCharacters: 200, overlapCharacters: 30 },
    );
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.pageStart === 3 && chunk.pageEnd === 3)).toBe(true);
    expect(chunks.every((chunk) => chunk.content.length <= 200)).toBe(true);
    expect(chunks[0].sectionHeading).toBe("Leave policy");
    expect(chunks[1].content.slice(0, 20)).toBe(chunks[0].content.slice(-30).slice(0, 20));
  });

  it("rejects invalid chunk configuration", () => {
    expect(() => chunkPolicyPages([], { maxCharacters: 100, overlapCharacters: 0 })).toThrow("at least");
    expect(() => chunkPolicyPages([], { maxCharacters: 200, overlapCharacters: 200 })).toThrow("smaller");
  });
});
