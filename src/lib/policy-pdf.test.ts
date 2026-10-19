import { describe, expect, it, vi } from "vitest";

const pdfMocks = vi.hoisted(() => ({
  getText: vi.fn(),
  destroy: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("pdf-parse", () => ({
  PDFParse: vi.fn(() => pdfMocks),
}));

import { extractPolicyPages, validatePolicyUpload } from "./policy-pdf";

const upload = (overrides: Partial<{
  name: string;
  type: string;
  size: number;
  data: Uint8Array;
}> = {}) => {
  const data = overrides.data ?? new TextEncoder().encode("%PDF-1.7");
  return {
    name: overrides.name ?? "policy.pdf",
    type: overrides.type ?? "application/pdf",
    size: overrides.size ?? data.length,
    arrayBuffer: async () => data.buffer,
  };
};

describe("policy PDF handling", () => {
  it("rejects non-PDF names, MIME types, and oversized files", () => {
    expect(() => validatePolicyUpload(upload({ name: "policy.txt" }))).toThrow("Only PDF");
    expect(() => validatePolicyUpload(upload({ type: "text/plain" }))).toThrow("Only PDF");
    expect(() => validatePolicyUpload(upload({ size: 11 }), 10)).toThrow("between");
  });

  it("extracts non-empty text with page numbers", async () => {
    pdfMocks.getText.mockResolvedValueOnce({
      pages: [{ num: 1, text: "Leave policy" }, { num: 2, text: "Approval rules" }],
    });
    await expect(extractPolicyPages(new TextEncoder().encode("%PDF-1.7")))
      .resolves.toEqual([
        { pageNumber: 1, text: "Leave policy" },
        { pageNumber: 2, text: "Approval rules" },
      ]);
    expect(pdfMocks.destroy).toHaveBeenCalled();
  });

  it("rejects a file with a PDF extension but invalid magic bytes", async () => {
    await expect(extractPolicyPages(new TextEncoder().encode("not a PDF")))
      .rejects.toThrow("not a valid PDF");
  });
});
