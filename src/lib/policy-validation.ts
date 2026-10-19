export const MAX_POLICY_BYTES = 10 * 1024 * 1024;

export type ValidatedPolicyFile = {
  bytes: Buffer;
  filename: string;
  mimeType: "application/pdf";
};

export async function validatePolicyFile(file: File): Promise<ValidatedPolicyFile> {
  if (!file || file.size === 0) throw new Error("Choose a PDF policy document.");
  if (file.size > MAX_POLICY_BYTES) throw new Error("Policy PDFs must be 10 MB or smaller.");
  const filename = file.name.trim() || "policy.pdf";
  if (file.type && file.type !== "application/pdf") {
    throw new Error("Only PDF policy documents are supported.");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("The uploaded file is not a readable PDF.");
  }
  return { bytes, filename, mimeType: "application/pdf" };
}

export function normalizeExtractedText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

export type PolicyTextChunk = {
  content: string;
  chunkIndex: number;
  pageStart: number | null;
  pageEnd: number | null;
  section: string | null;
};

export function chunkPolicyPages(
  pages: Array<{ pageNumber: number; text: string }>,
  maxCharacters = 1800,
  overlapCharacters = 250,
): PolicyTextChunk[] {
  if (maxCharacters <= overlapCharacters) throw new Error("Chunk overlap must be smaller than chunk size.");
  const chunks: PolicyTextChunk[] = [];
  let current = "";
  let pageStart: number | null = null;
  let pageEnd: number | null = null;

  const flush = () => {
    const content = current.trim();
    if (!content) return;
    chunks.push({
      content,
      chunkIndex: chunks.length,
      pageStart,
      pageEnd,
      section: content.split("\n")[0]?.slice(0, 160) || null,
    });
    const overlap = content.slice(Math.max(0, content.length - overlapCharacters));
    current = overlap;
    pageStart = pageEnd;
  };

  for (const page of pages) {
    const text = normalizeExtractedText(page.text);
    if (!text) continue;
    for (const paragraph of text.split(/\n{2,}/)) {
      if (!paragraph) continue;
      if (current && current.length + paragraph.length + 2 > maxCharacters) flush();
      if (pageStart === null) pageStart = page.pageNumber;
      pageEnd = page.pageNumber;
      current = current ? `${current}\n\n${paragraph}` : paragraph;
      if (current.length >= maxCharacters) flush();
    }
  }
  flush();
  return chunks;
}
