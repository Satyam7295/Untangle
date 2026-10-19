export type EmbeddingProvider = {
  generateEmbedding(input: string): Promise<readonly number[]>;
};

export function getEmbeddingProvider(): EmbeddingProvider {
  throw new Error(
    "No embedding provider is configured. Inject a server-side EmbeddingProvider or configure the existing embedding integration.",
  );
}
