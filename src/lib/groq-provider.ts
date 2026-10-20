export type GroqEnvironment = Record<string, string | undefined>;

export type GroqStructuredRequest = {
  systemPrompt: string;
  userPrompt: string;
  schema: Record<string, unknown>;
};

export type GroqProviderOptions = {
  environment?: GroqEnvironment;
  fetchImplementation?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  sleep?: (milliseconds: number) => Promise<void>;
};

export class GroqProviderError extends Error {
  readonly code:
    | "MISSING_CREDENTIALS"
    | "TIMEOUT"
    | "RATE_LIMITED"
    | "HTTP_ERROR"
    | "MALFORMED_RESPONSE"
    | "NETWORK_ERROR";

  constructor(
    code: GroqProviderError["code"],
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "GroqProviderError";
    this.code = code;
  }
}

export type GroqProvider = {
  completeStructured(request: GroqStructuredRequest): Promise<unknown>;
};

const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 2;
const MAX_RETRY_DELAY_MS = 2_000;

type GroqResponse = {
  choices?: Array<{ message?: { content?: unknown } }>;
};

function parseJsonContent(content: unknown): unknown {
  if (typeof content !== "string") {
    throw new GroqProviderError("MALFORMED_RESPONSE", "Groq returned no structured content.");
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new GroqProviderError(
      "MALFORMED_RESPONSE",
      "Groq returned malformed structured content.",
      { cause: error },
    );
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter >= 0) {
    return Math.min(retryAfter * 1_000, MAX_RETRY_DELAY_MS);
  }
  return Math.min(250 * 2 ** attempt, MAX_RETRY_DELAY_MS);
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export function getGroqConfiguration(environment: GroqEnvironment = process.env): {
  apiKey: string;
  model: string;
} {
  const apiKey = environment.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new GroqProviderError(
      "MISSING_CREDENTIALS",
      "GROQ_API_KEY is not configured. Set it in the server-only environment.",
    );
  }

  return {
    apiKey,
    model: environment.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL,
  };
}

export function createGroqProvider(options: GroqProviderOptions = {}): GroqProvider {
  const { apiKey, model } = getGroqConfiguration(options.environment);
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));

  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new Error("Groq timeout must be a positive integer.");
  }
  if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 5) {
    throw new Error("Groq maxRetries must be an integer between 0 and 5.");
  }

  return {
    async completeStructured(request) {
      const body = JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `${request.systemPrompt}\nReturn one JSON object matching this schema exactly: ${JSON.stringify(request.schema)}`,
          },
          { role: "user", content: request.userPrompt },
        ],
        response_format: {
          type: "json_object",
        },
      });

      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        let response: Response;
        try {
          response = await fetchImplementation(GROQ_CHAT_COMPLETIONS_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body,
            signal: controller.signal,
          });
        } catch (error) {
          if (controller.signal.aborted) {
            if (attempt < maxRetries) {
              await sleep(Math.min(250 * 2 ** attempt, MAX_RETRY_DELAY_MS));
              continue;
            }
            throw new GroqProviderError("TIMEOUT", "Groq request timed out.", { cause: error });
          }
          if (attempt < maxRetries) {
            await sleep(Math.min(250 * 2 ** attempt, MAX_RETRY_DELAY_MS));
            continue;
          }
          throw new GroqProviderError("NETWORK_ERROR", "Groq request failed.", { cause: error });
        } finally {
          clearTimeout(timeout);
        }

        if (!response.ok) {
          if (isRetryableStatus(response.status) && attempt < maxRetries) {
            await sleep(retryDelay(response, attempt));
            continue;
          }
          throw new GroqProviderError(
            response.status === 429 ? "RATE_LIMITED" : "HTTP_ERROR",
            response.status === 429
              ? "Groq rate limit exceeded."
              : `Groq request failed with status ${response.status}.`,
          );
        }

        let payload: GroqResponse;
        try {
          payload = (await response.json()) as GroqResponse;
        } catch (error) {
          throw new GroqProviderError("MALFORMED_RESPONSE", "Groq returned invalid JSON.", {
            cause: error,
          });
        }

        return parseJsonContent(payload.choices?.[0]?.message?.content);
      }

      throw new GroqProviderError("HTTP_ERROR", "Groq request could not be completed.");
    },
  };
}

export { DEFAULT_GROQ_MODEL };
