import { describe, expect, it, vi } from "vitest";

import { getEmbeddingConfiguration, getEmbeddingProvider } from "./embedding-provider";

describe("embedding provider", () => {
  it("requires a server-side API key and supports configurable endpoints", () => {
    expect(() => getEmbeddingConfiguration({})).toThrow("EMBEDDING_API_KEY");
    expect(getEmbeddingConfiguration({
      EMBEDDING_API_KEY: "secret",
      EMBEDDING_BASE_URL: "https://embeddings.test/v1/",
      EMBEDDING_MODEL: "model-a",
    })).toEqual({
      apiKey: "secret",
      baseUrl: "https://embeddings.test/v1",
      model: "model-a",
    });
  });

  it("calls the OpenAI-compatible embeddings endpoint and validates the vector", async () => {
    vi.stubEnv("EMBEDDING_API_KEY", "secret");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(
      JSON.stringify({ data: [{ embedding: [0.1, 0.2] }] }),
      { status: 200 },
    ));
    const provider = getEmbeddingProvider();
    await expect(provider.generateEmbedding("policy text")).resolves.toEqual([0.1, 0.2]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/embeddings"),
      expect.objectContaining({ method: "POST", body: expect.stringContaining("policy text") }),
    );
    fetchMock.mockRestore();
    vi.unstubAllEnvs();
  });
});
