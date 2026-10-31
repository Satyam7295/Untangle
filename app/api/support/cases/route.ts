import { NextResponse } from "next/server";

import { isSupportAuthenticated } from "../../../../src/lib/admin-auth";
import { listSupportCases } from "../../../../src/lib/support-cases";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (!(await isSupportAuthenticated())) {
    return NextResponse.json({ error: "Support authentication required." }, { status: 401 });
  }

  const cases = await listSupportCases();
  return NextResponse.json({
    cases: cases.map((supportCase) => ({
      id: supportCase.id,
      referenceNumber: supportCase.referenceNumber,
      originalQuery: supportCase.originalQuery,
      status: supportCase.status,
      priority: supportCase.priority,
      createdAt: supportCase.createdAt,
      updatedAt: supportCase.updatedAt,
      latestActivity: supportCase.messages[0]?.createdAt ?? supportCase.updatedAt,
    })),
  });
}
