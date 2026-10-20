import { describe, expect, it, vi } from "vitest";

import { getEmbeddingConfiguration, getEmbeddingProvider } from "./embedding-provider";

const environment = {
  EMBEDDING_PROVIDER: "cloudflare",
  EMBEDDING_MODEL: "@cf/baai/bge-small-en-v1.5",
  EMBEDDING_DIMENSIONS: "384",
  CLOUDFLARE_ACCOUNT_ID: "account-id",
  CLOUDFLARE_API_TOKEN: "secret-token",
};

describe("Cloudflare Workers AI embedding provider", () => {
  it("validates server-side configuration", () => {
    expect(() => getEmbeddingConfiguration({})).toThrow("EMBEDDING_PROVIDER");
    expect(getEmbeddingConfiguration(environment)).toEqual({
      provider: "cloudflare",
      model: "@cf/baai/bge-small-en-v1.5",
      dimensions: 384,
      accountId: "account-id",
      apiToken: "secret-token",
    });
    expect(() => getEmbeddingConfiguration({
      ...environment,
      EMBEDDING_DIMENSIONS: "3",
    })).toThrow("EMBEDDING_DIMENSIONS");
  });

  it("calls Cloudflare and returns the exact finite vector", async () => {
    vi.stubEnv("EMBEDDING_PROVIDER", environment.EMBEDDING_PROVIDER);
    vi.stubEnv("EMBEDDING_MODEL", environment.EMBEDDING_MODEL);
    vi.stubEnv("EMBEDDING_DIMENSIONS", environment.EMBEDDING_DIMENSIONS);
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", environment.CLOUDFLARE_ACCOUNT_ID);
    vi.stubEnv("CLOUDFLARE_API_TOKEN", environment.CLOUDFLARE_API_TOKEN);
    const vector = Array.from({ length: 384 }, (_, index) => index / 384);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(
      JSON.stringify({ success: true, result: { data: [vector] } }),
      { status: 200 },
    ));
    const provider = getEmbeddingProvider();
    await expect(provider.generateEmbedding("policy text")).resolves.toEqual(vector);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/accounts/account-id/ai/run/@cf/baai/bge-small-en-v1.5",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: ["Bearer", environment.CLOUDFLARE_API_TOKEN].join(" "),
        }),
        body: JSON.stringify({ text: ["policy text"] }),
      }),
    );
    fetchMock.mockRestore();
    vi.unstubAllEnvs();
  });

  it.each([
    { status: 500, body: { success: false, errors: [{ message: "failure" }] }, message: "HTTP 500" },
    { status: 200, body: { success: false, errors: [] }, message: "API error" },
    { status: 200, body: { success: true, result: { data: [[0.1]] } }, message: "expected 384" },
  ])("rejects $message", async ({ status, body, message }) => {
    vi.stubEnv("EMBEDDING_PROVIDER", "cloudflare");
    vi.stubEnv("EMBEDDING_MODEL", "@cf/baai/bge-small-en-v1.5");
    vi.stubEnv("EMBEDDING_DIMENSIONS", "384");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "account-id");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "secret-token");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status }));
    await expect(getEmbeddingProvider().generateEmbedding("text")).rejects.toThrow(message);
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("rejects empty input", async () => {
    await expect(getEmbeddingProviderWithTestConfig().generateEmbedding(" ")).rejects.toThrow("empty");
    vi.unstubAllEnvs();
  });
});

function getEmbeddingProviderWithTestConfig() {
  vi.stubEnv("EMBEDDING_PROVIDER", "cloudflare");
  vi.stubEnv("EMBEDDING_MODEL", "@cf/baai/bge-small-en-v1.5");
  vi.stubEnv("EMBEDDING_DIMENSIONS", "384");
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "account-id");
  vi.stubEnv("CLOUDFLARE_API_TOKEN", "secret-token");
  return getEmbeddingProvider();
}
