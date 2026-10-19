import { describe, expect, it, vi } from "vitest";

import {
  createGroqProvider,
  GroqProviderError,
  getGroqConfiguration,
} from "./groq-provider";

const request = {
  systemPrompt: "Return JSON.",
  userPrompt: "Question",
  schema: { type: "object" },
};

function response(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("Groq provider", () => {
  it("requires credentials and uses the configured model without exposing the key in output", async () => {
    expect(() => getGroqConfiguration({})).toThrow(GroqProviderError);
    const fetchImplementation = vi.fn().mockResolvedValue(
      response({ choices: [{ message: { content: '{"ok":true}' } }] }),
    );
    const result = await createGroqProvider({
      environment: { GROQ_API_KEY: "test-secret", GROQ_MODEL: "test-model" },
      fetchImplementation,
    }).completeStructured(request);

    expect(result).toEqual({ ok: true });
    expect(JSON.stringify(result)).not.toContain("test-secret");
    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://api.groq.com/openai/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-secret" }),
        body: expect.stringContaining('"model":"test-model"'),
      }),
    );
  });

  it("retries rate limits and server failures only within the configured limit", async () => {
    const fetchImplementation = vi.fn()
      .mockResolvedValueOnce(response({}, { status: 429, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(response({}, { status: 500 }))
      .mockResolvedValueOnce(response({ choices: [{ message: { content: '{"ok":true}' } }] }));
    const result = await createGroqProvider({
      environment: { GROQ_API_KEY: "test-secret" },
      fetchImplementation,
      sleep: vi.fn().mockResolvedValue(undefined),
      maxRetries: 2,
    }).completeStructured(request);

    expect(result).toEqual({ ok: true });
    expect(fetchImplementation).toHaveBeenCalledTimes(3);
  });

  it("reports malformed output and timeout after retry limits", async () => {
    const malformed = createGroqProvider({
      environment: { GROQ_API_KEY: "test-secret" },
      fetchImplementation: vi.fn().mockResolvedValue(
        response({ choices: [{ message: { content: "not-json" } }] }),
      ),
      maxRetries: 0,
    });
    await expect(malformed.completeStructured(request)).rejects.toMatchObject({
      code: "MALFORMED_RESPONSE",
    });

    const timeout = createGroqProvider({
      environment: { GROQ_API_KEY: "test-secret" },
      fetchImplementation: vi.fn((_, init) => new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      })),
      timeoutMs: 1,
      maxRetries: 0,
    });
    await expect(timeout.completeStructured(request)).rejects.toMatchObject({
      code: "TIMEOUT",
    });
  });

  it("does not retry non-retryable provider errors", async () => {
    const fetchImplementation = vi.fn().mockResolvedValue(response({}, { status: 401 }));
    await expect(createGroqProvider({
      environment: { GROQ_API_KEY: "test-secret" },
      fetchImplementation,
      sleep: vi.fn().mockResolvedValue(undefined),
    }).completeStructured(request)).rejects.toMatchObject({ code: "HTTP_ERROR" });
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });
});
