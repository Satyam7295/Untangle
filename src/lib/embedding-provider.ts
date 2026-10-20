export type EmbeddingMetadata = {
  provider: string;
  model: string;
  dimensions: number;
};

export type EmbeddingProvider = {
  generateEmbedding(input: string): Promise<readonly number[]>;
  readonly metadata?: EmbeddingMetadata;
};

export class EmbeddingProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmbeddingProviderError";
  }
}

export type EmbeddingConfiguration = EmbeddingMetadata & {
  accountId: string;
  apiToken: string;
};

const CLOUDFLARE_PROVIDER = "cloudflare";
const DEFAULT_MODEL = "@cf/baai/bge-small-en-v1.5";
const DEFAULT_DIMENSIONS = 384;
const REQUEST_TIMEOUT_MS = 30_000;

function requiredEnvironmentValue(
  environment: Record<string, string | undefined>,
  name: string,
): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required for Cloudflare Workers AI embeddings.`);
  return value;
}

function getEmbeddingConfiguration(
  environment: Record<string, string | undefined> = process.env,
): EmbeddingConfiguration {
  const provider = requiredEnvironmentValue(environment, "EMBEDDING_PROVIDER").toLowerCase();
  if (provider !== CLOUDFLARE_PROVIDER) {
    throw new Error(`Unsupported embedding provider "${provider}". Set EMBEDDING_PROVIDER=cloudflare.`);
  }

  const dimensionsValue = requiredEnvironmentValue(environment, "EMBEDDING_DIMENSIONS");
  const dimensions = Number(dimensionsValue);
  if (!Number.isInteger(dimensions) || dimensions !== DEFAULT_DIMENSIONS) {
    throw new Error(`EMBEDDING_DIMENSIONS must be ${DEFAULT_DIMENSIONS} for ${DEFAULT_MODEL}.`);
  }

  return {
    provider,
    model: requiredEnvironmentValue(environment, "EMBEDDING_MODEL"),
    dimensions,
    accountId: requiredEnvironmentValue(environment, "CLOUDFLARE_ACCOUNT_ID"),
    apiToken: requiredEnvironmentValue(environment, "CLOUDFLARE_API_TOKEN"),
  };
}

function readCloudflareEmbedding(body: unknown, dimensions: number): number[] {
  const result = (body as { result?: { data?: unknown } }).result;
  const embedding = Array.isArray(result?.data) && Array.isArray(result.data[0])
    ? result.data[0]
    : null;
  if (
    !embedding
    || embedding.length !== dimensions
    || !embedding.every((value): value is number => typeof value === "number" && Number.isFinite(value))
  ) {
    throw new EmbeddingProviderError(
      `Cloudflare Workers AI returned an invalid embedding; expected ${dimensions} finite numeric values.`,
    );
  }
  return embedding;
}

class CloudflareEmbeddingProvider implements EmbeddingProvider {
  readonly metadata: EmbeddingMetadata;

  constructor(private readonly configuration: EmbeddingConfiguration) {
    this.metadata = {
      provider: configuration.provider,
      model: configuration.model,
      dimensions: configuration.dimensions,
    };
  }

  async generateEmbedding(input: string): Promise<readonly number[]> {
    if (typeof input !== "string" || !input.trim()) {
      throw new EmbeddingProviderError("Embedding input cannot be empty.");
    }

    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
      this.configuration.accountId,
    )}/ai/run/${this.configuration.model}`;
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          authorization: ["Bearer", this.configuration.apiToken].join(" "),
          "content-type": "application/json",
        },
        body: JSON.stringify({ text: [input] }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new EmbeddingProviderError("Cloudflare Workers AI embedding request timed out.");
      }
      throw new EmbeddingProviderError("Cloudflare Workers AI embedding request failed.");
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new EmbeddingProviderError("Cloudflare Workers AI returned an unreadable response.");
    }
    if (!response.ok) {
      throw new EmbeddingProviderError(`Cloudflare Workers AI returned HTTP ${response.status}.`);
    }
    if (!(body as { success?: unknown }).success) {
      throw new EmbeddingProviderError("Cloudflare Workers AI reported an API error.");
    }
    return readCloudflareEmbedding(body, this.configuration.dimensions);
  }
}

export function getEmbeddingProvider(): EmbeddingProvider {
  return new CloudflareEmbeddingProvider(getEmbeddingConfiguration());
}

export { getEmbeddingConfiguration };
