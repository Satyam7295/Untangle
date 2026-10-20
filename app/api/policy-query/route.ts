import { NextResponse } from "next/server";

import { analyzePolicyQuery, type QueryAnalysisResult } from "../../../src/lib/query-analysis";
import { getPolicyTenantId } from "../../../src/lib/env";
import { createTrustedTenantContext } from "../../../src/lib/policy-tenant";
import { responseForResult } from "../../../src/lib/policy-query-response";

export const dynamic = "force-dynamic";

const QUERY_TIMEOUT_MS = 35_000;
const MAX_REQUEST_BODY_BYTES = 16 * 1024;

type PolicyQueryRequest = {
  query: unknown;
};

class RequestBodyTooLargeError extends Error {}

function errorResponse(status: number, message: string) {
  return NextResponse.json({ status: "REQUEST_ERROR", answer: message, sources: [] }, { status });
}

async function readRequestBody(request: Request): Promise<string> {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const parsedLength = Number(contentLength);
    if (Number.isFinite(parsedLength) && parsedLength > MAX_REQUEST_BODY_BYTES) {
      throw new RequestBodyTooLargeError();
    }
  }

  if (!request.body) return request.text();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_REQUEST_BODY_BYTES) {
        throw new RequestBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

export async function POST(request: Request): Promise<Response> {
  let body: PolicyQueryRequest;
  try {
    body = JSON.parse(await readRequestBody(request)) as PolicyQueryRequest;
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return errorResponse(413, "Request body is too large.");
    }
    return errorResponse(400, "Send a JSON object containing a query.");
  }

  if (!body || typeof body !== "object" || !("query" in body)) {
    return errorResponse(400, "Send a JSON object containing a query.");
  }

  let tenantContext;
  try {
    tenantContext = createTrustedTenantContext(getPolicyTenantId());
  } catch {
    return errorResponse(503, "Policy search is not configured. Please contact support.");
  }

  const analysis = analyzePolicyQuery({
    query: body.query as string,
    tenantContext,
  });
  let result: QueryAnalysisResult;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    result = await Promise.race([
      analysis,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Policy query timed out.")), QUERY_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return errorResponse(504, "Policy search is taking too long. Please try again.");
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  const response = responseForResult(result);
  const status = response.status === "INVALID_QUERY" ? 400
    : response.status === "EMBEDDING_PROVIDER_ERROR"
      || response.status === "RETRIEVAL_DATABASE_ERROR"
      || response.status === "GROQ_PROVIDER_ERROR" ? 503 : 200;
  return NextResponse.json(response, { status });
}
