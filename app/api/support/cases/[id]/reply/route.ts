import { NextResponse } from "next/server";

import { isSupportAuthenticated } from "../../../../../../src/lib/admin-auth";
import { replyToSupportCase } from "../../../../../../src/lib/support-cases";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!(await isSupportAuthenticated())) {
    return NextResponse.json({ error: "Support authentication required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { content?: unknown } | null;
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content || content.length > 10_000) {
    return NextResponse.json({ error: "Reply must contain between 1 and 10,000 characters." }, { status: 400 });
  }

  const { id } = await context.params;
  const message = await replyToSupportCase(id, content);
  if (!message) return NextResponse.json({ error: "Case not found." }, { status: 404 });
  return NextResponse.json({ message }, { status: 201 });
}
