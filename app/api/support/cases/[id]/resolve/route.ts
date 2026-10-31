import { NextResponse } from "next/server";

import { isSupportAuthenticated } from "../../../../../../src/lib/admin-auth";
import { resolveSupportCase } from "../../../../../../src/lib/support-cases";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!(await isSupportAuthenticated())) {
    return NextResponse.json({ error: "Support authentication required." }, { status: 401 });
  }

  const { id } = await context.params;
  const supportCase = await resolveSupportCase(id);
  if (!supportCase) return NextResponse.json({ error: "Case not found." }, { status: 404 });
  return NextResponse.json({ case: supportCase });
}
