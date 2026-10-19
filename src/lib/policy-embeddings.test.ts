import { beforeEach, describe, expect, it, vi } from "vitest";

import { createEmbedding } from "./policy-embeddings";

describe("policy embeddings", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.EMBEDDING_API_URL = "https://embedding.test/v1/embeddings";
    process.env.EMBEDDING_DIMENSIONS = "2";
    process.env.EMBEDDING_PROVIDER = "openai";
  });

  it("returns a validated vector from an OpenAI-compatible provider", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ embedding: [0.1, -0.2] }] }), { status: 200 }),
    ));
    await expect(createEmbedding("policy passage")).resolves.toEqual([0.1, -0.2]);
  });

  it("surfaces provider failures and malformed vectors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("failure", { status: 503 })));
    await expect(createEmbedding("policy passage")).rejects.toThrow("HTTP 503");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ embedding: [0.1] }] }), { status: 200 }),
    ));
    await expect(createEmbedding("policy passage")).rejects.toThrow("expected 2 finite dimensions");
  });

  it("requires credentials and rejects unsupported providers", async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(createEmbedding("policy passage")).rejects.toThrow("OPENAI_API_KEY");

    process.env.OPENAI_API_KEY = "test-key";
    process.env.EMBEDDING_PROVIDER = "groq";
    await expect(createEmbedding("policy passage")).rejects.toThrow("Unsupported embedding provider");
  });
});
