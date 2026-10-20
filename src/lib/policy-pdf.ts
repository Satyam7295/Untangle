import type { ExtractedPolicyPage } from "./policy-chunking";

export const DEFAULT_MAX_POLICY_UPLOAD_BYTES = 20 * 1024 * 1024;

export type PolicyUpload = {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBufferLike>;
};

export function validatePolicyUpload(
  file: PolicyUpload,
  maxBytes = DEFAULT_MAX_POLICY_UPLOAD_BYTES,
): void {
  if (!file || typeof file.name !== "string" || typeof file.arrayBuffer !== "function") {
    throw new Error("Select a PDF policy document.");
  }
  if (!file.name.toLowerCase().endsWith(".pdf") || (file.type && file.type !== "application/pdf")) {
    throw new Error("Only PDF policy documents are accepted.");
  }
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > maxBytes) {
    throw new Error(`The PDF must be between 1 byte and ${maxBytes} bytes.`);
  }
}

export async function extractPolicyPages(data: Uint8Array): Promise<ExtractedPolicyPage[]> {
  if (data.length < 5 || new TextDecoder().decode(data.slice(0, 5)) !== "%PDF-") {
    throw new Error("The uploaded file is not a valid PDF.");
  }
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText({ lineEnforce: true });
    const pages = result.pages
      .map((page) => ({ pageNumber: page.num, text: page.text.trim() }))
      .filter((page) => page.text.length > 0);
    if (pages.length === 0) throw new Error("The PDF contains no extractable text.");
    return pages;
  } finally {
    await parser.destroy();
  }
}
