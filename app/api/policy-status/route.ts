import { NextResponse } from "next/server";

import { getPolicyTenantId } from "../../../src/lib/env";
import { prisma } from "../../../src/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  let tenantId: string;
  try {
    tenantId = getPolicyTenantId();
  } catch {
    return NextResponse.json({ status: "UNAVAILABLE", message: "Policy search is not configured." }, { status: 503 });
  }

  const policy = await prisma.policyDocument.findFirst({
    where: { tenantId, isActive: true },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: { fileName: true, indexingStatus: true },
  });

  return NextResponse.json({
    status: policy?.indexingStatus ?? "NOT_CONFIGURED",
    fileName: policy?.fileName ?? null,
  });
}
