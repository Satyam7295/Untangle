export type EmbeddingClient = (text: string) => Promise<number[]>;

export type EmbeddingProvider = {
  name: string;
  embed(text: string): Promise<number[]>;
};

type EmbeddingConfiguration = {
  url: string;
  apiKey: string;
  model: string;
  dimensions: number;
};

function embeddingConfiguration(): EmbeddingConfiguration {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured for policy indexing.");
  const provider = process.env.EMBEDDING_PROVIDER?.trim().toLowerCase() || "openai";
  if (provider !== "openai") {
    throw new Error(`Unsupported embedding provider "${provider}". Configure a supported embedding provider.`);
  }
  const dimensions = Number.parseInt(process.env.EMBEDDING_DIMENSIONS || "1536", 10);
  if (!Number.isInteger(dimensions) || dimensions <= 0) {
    throw new Error("EMBEDDING_DIMENSIONS must be a positive integer.");
  }
  return {
    apiKey,
    model: process.env.EMBEDDING_MODEL?.trim() || "text-embedding-3-small",
    url: process.env.EMBEDDING_API_URL?.trim() || "https://api.openai.com/v1/embeddings",
    dimensions,
  };
}

export function createOpenAIEmbeddingProvider(): EmbeddingProvider {
  return {
    name: "openai",
    async embed(text: string): Promise<number[]> {
      const configuration = embeddingConfiguration();
      const response = await fetch(configuration.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${configuration.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: text,
          model: configuration.model,
          dimensions: configuration.dimensions,
        }),
      });
      if (!response.ok) {
        throw new Error(`Embedding provider returned HTTP ${response.status}.`);
      }
      const body: unknown = await response.json();
      const vector = (body as { data?: Array<{ embedding?: unknown }> }).data?.[0]?.embedding;
      if (
        !Array.isArray(vector) ||
        vector.length !== configuration.dimensions ||
        vector.some((value) => typeof value !== "number" || !Number.isFinite(value))
      ) {
        throw new Error(
          `Embedding provider returned an invalid vector; expected ${configuration.dimensions} finite dimensions.`,
        );
      }
      return vector;
    },
  };
}

export function createEmbedding(text: string): Promise<number[]> {
  return createOpenAIEmbeddingProvider().embed(text);
}
