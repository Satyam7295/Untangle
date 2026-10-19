export type ExtractedPolicyPage = {
  pageNumber: number;
  text: string;
};

export type PolicyChunk = {
  chunkIndex: number;
  content: string;
  pageStart: number;
  pageEnd: number;
  sectionHeading: string | null;
};

export type ChunkingOptions = {
  maxCharacters: number;
  overlapCharacters: number;
};

function headingFor(text: string): string | null {
  const firstLine = text.split("\n").map((line) => line.trim()).find(Boolean);
  if (!firstLine || firstLine.length > 120 || /[.!?:;]$/.test(firstLine)) return null;
  return firstLine;
}

export function chunkPolicyPages(
  pages: readonly ExtractedPolicyPage[],
  options: ChunkingOptions,
): PolicyChunk[] {
  if (!Number.isInteger(options.maxCharacters) || options.maxCharacters < 200) {
    throw new Error("Policy chunk size must be at least 200 characters.");
  }
  if (!Number.isInteger(options.overlapCharacters) || options.overlapCharacters < 0
    || options.overlapCharacters >= options.maxCharacters) {
    throw new Error("Policy chunk overlap must be non-negative and smaller than the chunk size.");
  }

  const chunks: PolicyChunk[] = [];
  for (const page of pages) {
    const text = page.text.trim().replace(/\s+/g, " ");
    if (!text) continue;
    const heading = headingFor(page.text);
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + options.maxCharacters, text.length);
      const content = text.slice(start, end).trim();
      if (content) {
        chunks.push({
          chunkIndex: chunks.length,
          content,
          pageStart: page.pageNumber,
          pageEnd: page.pageNumber,
          sectionHeading: heading,
        });
      }
      if (end === text.length) break;
      start = Math.max(start + 1, end - options.overlapCharacters);
    }
  }
  return chunks;
}
