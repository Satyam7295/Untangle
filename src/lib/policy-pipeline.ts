import { createHash } from "node:crypto";

import { PDFParse } from "pdf-parse";
import { Prisma, type PolicyIndexStatus } from "@prisma/client";

import { prisma } from "./prisma";
import { createEmbedding, type EmbeddingClient } from "./policy-embeddings";
import { readPolicyPdf, storePolicyPdf } from "./policy-storage";
import { chunkPolicyPages, normalizeExtractedText } from "./policy-validation";

export type PolicyPipelineDependencies = {
  embed?: EmbeddingClient;
  saveFile?: typeof storePolicyPdf;
  readFile?: typeof readPolicyPdf;
};

export type PipelineResult = {
  documentId: string;
  status: PolicyIndexStatus;
  message: string;
};

export function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function extractPolicyPages(bytes: Buffer): Promise<Array<{ pageNumber: number; text: string }>> {
  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText();
    const pages = result.pages.map((page) => ({
      pageNumber: page.num,
      text: normalizeExtractedText(page.text),
    }));
    if (!pages.some((page) => page.text.length > 0)) {
      throw new Error("This PDF contains no extractable text. Scanned PDFs are not supported without OCR.");
    }
    return pages;
  } finally {
    await parser.destroy();
  }
}

async function markFailed(tenantId: string, documentId: string, message: string): Promise<void> {
  try {
    await prisma.policyDocument.update({
      where: { id: documentId, tenantId },
      data: { status: "FAILED", errorMessage: message.slice(0, 1000), isActive: false },
    });
  } catch {
    // The original failure is returned to the caller; a database outage cannot be reported through the status row.
  }
}

export async function indexPolicyDocument(
  tenantId: string,
  documentId: string,
  dependencies: PolicyPipelineDependencies = {},
): Promise<PipelineResult> {
  const embed = dependencies.embed || createEmbedding;
  const readFile = dependencies.readFile || readPolicyPdf;

  const document = await prisma.policyDocument.findFirst({
    where: { id: documentId, tenantId },
  });
  if (!document) throw new Error("Policy document was not found in this organization.");
  if (document.status === "READY" && document.isActive) {
    return { documentId, status: "READY", message: "Policy is already indexed and active." };
  }

  await prisma.policyDocument.update({
    where: { id: documentId, tenantId },
    data: { status: "PROCESSING", errorMessage: null, isActive: false },
  });

  try {
    const bytes = await readFile(document.storageKey);
    const pages = await extractPolicyPages(bytes);
    const chunks = chunkPolicyPages(pages);
    if (chunks.length === 0) throw new Error("The PDF contains no usable policy text.");

    const embeddings: number[][] = [];
    for (const chunk of chunks) {
      embeddings.push(await embed(chunk.content));
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.policyChunk.deleteMany({ where: { tenantId, policyDocumentId: documentId } });
      for (const [index, chunk] of chunks.entries()) {
        await transaction.policyChunk.create({
          data: {
            tenantId,
            policyDocumentId: documentId,
            chunkIndex: index,
            content: chunk.content,
            embedding: embeddings[index] as Prisma.InputJsonValue,
            pageStart: chunk.pageStart,
            pageEnd: chunk.pageEnd,
            section: chunk.section,
          },
        });
      }
      await transaction.policyDocument.update({
        where: { id: documentId, tenantId },
        data: { pageCount: pages.length, chunkCount: chunks.length, status: "READY", errorMessage: null },
      });
      await transaction.policyDocument.updateMany({
        where: { tenantId, isActive: true, id: { not: documentId } },
        data: { isActive: false },
      });
      await transaction.policyDocument.update({
        where: { id: documentId, tenantId },
        data: { isActive: true, activatedAt: new Date() },
      });
    });

    return { documentId, status: "READY", message: "Policy extracted and indexed successfully." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Policy indexing failed.";
    await markFailed(tenantId, documentId, message);
    return { documentId, status: "FAILED", message };
  }
}

export async function createAndIndexPolicy(
  tenantId: string,
  filename: string,
  mimeType: string,
  bytes: Buffer,
  dependencies: PolicyPipelineDependencies = {},
): Promise<PipelineResult> {
  const digest = sha256(bytes);
  const existing = await prisma.policyDocument.findFirst({
    where: { tenantId, sha256: digest },
    orderBy: { createdAt: "desc" },
  });
  if (existing?.status === "READY" && existing.isActive) {
    return { documentId: existing.id, status: "READY", message: "This policy is already indexed and active." };
  }
  if (existing?.status === "PROCESSING") {
    return { documentId: existing.id, status: "PROCESSING", message: "This policy is already being indexed." };
  }
  if (existing?.status === "FAILED") {
    return indexPolicyDocument(tenantId, existing.id, dependencies);
  }

  const document = await prisma.policyDocument.create({
    data: {
      tenantId,
      originalFilename: filename.slice(0, 255),
      storageKey: `pending-${crypto.randomUUID()}.pdf`,
      sha256: digest,
      mimeType,
      sizeBytes: bytes.length,
      status: "PENDING",
    },
  });

  try {
    const saveFile = dependencies.saveFile || storePolicyPdf;
    const storageKey = await saveFile(document.id, bytes);
    await prisma.policyDocument.update({ where: { id: document.id, tenantId }, data: { storageKey } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Policy storage failed.";
    await markFailed(tenantId, document.id, message);
    return { documentId: document.id, status: "FAILED", message };
  }

  return indexPolicyDocument(tenantId, document.id, dependencies);
}
