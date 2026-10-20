import { loadEnvConfig } from "@next/env";

import { getEmbeddingProvider } from "../src/lib/embedding-provider";

loadEnvConfig(process.cwd());

async function main(): Promise<void> {
  const provider = getEmbeddingProvider();
  const metadata = provider.metadata;
  if (
    !metadata
    || metadata.provider !== "cloudflare"
    || metadata.model !== "@cf/baai/bge-small-en-v1.5"
    || metadata.dimensions !== 384
  ) {
    throw new Error("Cloudflare embedding configuration is not the required BGE-small 384-dimensional configuration.");
  }

  const vector = await provider.generateEmbedding("A harmless verification sentence about workplace policy.");
  if (
    vector.length !== 384
    || !vector.every((value) => typeof value === "number" && Number.isFinite(value))
  ) {
    throw new Error("Cloudflare embedding verification returned an invalid vector.");
  }

  console.log("Cloudflare embedding verification passed: HTTP/API success and 384 finite values.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Cloudflare embedding verification failed.");
  process.exitCode = 1;
});
