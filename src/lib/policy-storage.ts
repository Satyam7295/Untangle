import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_STORAGE_DIR = path.join(process.cwd(), ".data", "policies");

function storageDirectory(): string {
  return process.env.POLICY_STORAGE_DIR?.trim() || DEFAULT_STORAGE_DIR;
}

export async function storePolicyPdf(documentId: string, bytes: Buffer): Promise<string> {
  const directory = storageDirectory();
  await mkdir(directory, { recursive: true });
  const storageKey = `${documentId}.pdf`;
  await writeFile(path.join(directory, storageKey), bytes, { flag: "wx", mode: 0o600 });
  return storageKey;
}

export async function readPolicyPdf(storageKey: string): Promise<Buffer> {
  const basename = path.basename(storageKey);
  if (basename !== storageKey || !storageKey.endsWith(".pdf")) {
    throw new Error("Invalid policy storage key.");
  }
  return readFile(path.join(storageDirectory(), basename));
}
