"use server";

import { redirect } from "next/navigation";

import { clearAdminSession, requireAdmin } from "../../src/lib/admin-auth";
import { getAdminConfiguration } from "../../src/lib/env";
import { ingestPolicyPdf } from "../../src/lib/policy-ingestion";

export type PolicyUploadState = { error?: string; success?: string };

export async function uploadPolicy(
  _previous: PolicyUploadState,
  formData: FormData,
): Promise<PolicyUploadState> {
  await requireAdmin();
  const file = formData.get("policy-file");
  if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
    return { error: "Select a PDF policy document." };
  }
  try {
    const result = await ingestPolicyPdf(
      getAdminConfiguration().tenantId,
      file as File,
    );
    return { success: `Policy indexed successfully (${result.chunkCount} chunks).` };
  } catch (error) {
    return {
      error: error instanceof Error
        ? error.message
        : "The policy could not be indexed. Please try again.",
    };
  }
}

export async function logoutAdmin(): Promise<void> {
  await clearAdminSession();
  redirect("/admin/login");
}
