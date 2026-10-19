import { describe, expect, it } from "vitest";

import {
  MAX_POLICY_BYTES,
  chunkPolicyPages,
  normalizeExtractedText,
  validatePolicyFile,
} from "./policy-validation";

describe("policy validation and chunking", () => {
  it("accepts a PDF signature and preserves page metadata in chunks", async () => {
    const file = new File([Buffer.from("%PDF-1.7 policy text")], "policy.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => Buffer.from("%PDF-1.7 policy text"),
    });
    const validated = await validatePolicyFile(file);
    const chunks = chunkPolicyPages([
      { pageNumber: 2, text: "Eligibility rules\n\nCustomers may request a refund." },
      { pageNumber: 3, text: "Escalation rules\n\nEscalate unresolved requests." },
    ], 80, 10);

    expect(validated.mimeType).toBe("application/pdf");
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]).toMatchObject({ chunkIndex: 0, pageStart: 2 });
    expect(chunks.some((chunk) => chunk.pageEnd === 3)).toBe(true);
  });

  it("rejects empty, non-PDF, and oversized files", async () => {
    await expect(validatePolicyFile(new File([], "empty.pdf", { type: "application/pdf" })))
      .rejects.toThrow("Choose a PDF");
    await expect(validatePolicyFile(new File(["not pdf"], "policy.txt", { type: "text/plain" })))
      .rejects.toThrow("Only PDF");
    await expect(
      validatePolicyFile(new File([new Uint8Array(MAX_POLICY_BYTES + 1)], "large.pdf", {
        type: "application/pdf",
      })),
    ).rejects.toThrow("10 MB");
  });

  it("normalizes whitespace and removes control characters", () => {
    expect(normalizeExtractedText("  A\u0000   policy\r\n\r\n\r\n rule  ")).toBe("A policy\n\nrule");
  });
});
