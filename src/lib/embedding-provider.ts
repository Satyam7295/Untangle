export type EmbeddingProvider = {
  generateEmbedding(input: string): Promise<readonly number[]>;
};

export class EmbeddingProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmbeddingProviderError";
  }
}

type EmbeddingConfiguration = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

function getEmbeddingConfiguration(
  environment: Record<string, string | undefined> = process.env,
): EmbeddingConfiguration {
  const apiKey = environment.EMBEDDING_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("No embedding provider is configured. Set EMBEDDING_API_KEY.");
  }
  return {
    apiKey,
    baseUrl: (environment.EMBEDDING_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, ""),
    model: environment.EMBEDDING_MODEL?.trim() || "text-embedding-3-small",
  };
}

class OpenAICompatibleEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly configuration: EmbeddingConfiguration) {}

  async generateEmbedding(input: string): Promise<readonly number[]> {
    const response = await fetch(`${this.configuration.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.configuration.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ input, model: this.configuration.model }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new EmbeddingProviderError(`Embedding provider returned HTTP ${response.status}.`);
    }
    const body: unknown = await response.json();
    const embedding = (body as { data?: Array<{ embedding?: unknown }> }).data?.[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.length === 0
      || !embedding.every((value): value is number => typeof value === "number" && Number.isFinite(value))) {
      throw new EmbeddingProviderError("Embedding provider returned an invalid vector.");
    }
    return embedding;
  }
}

export function getEmbeddingProvider(): EmbeddingProvider {
  return new OpenAICompatibleEmbeddingProvider(getEmbeddingConfiguration());
}

export { getEmbeddingConfiguration };
