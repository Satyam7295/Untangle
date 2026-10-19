"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "../../../src/lib/admin-auth";
import { createAndIndexPolicy, indexPolicyDocument } from "../../../src/lib/policy-pipeline";
import { validatePolicyFile } from "../../../src/lib/policy-validation";
import { getAdminTenant } from "../../../src/lib/policy-tenant";

export type PolicyActionState = {
  error?: string;
  success?: string;
  documentId?: string;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The policy could not be indexed. Try again.";
}

export async function uploadPolicy(
  _previous: PolicyActionState,
  formData: FormData,
): Promise<PolicyActionState> {
  await requireAdmin();
  const file = formData.get("policy-file");
  if (!(file instanceof File)) return { error: "Choose a PDF policy document." };

  try {
    const validated = await validatePolicyFile(file);
    const tenant = await getAdminTenant();
    const result = await createAndIndexPolicy(
      tenant.id,
      validated.filename,
      validated.mimeType,
      validated.bytes,
    );
    revalidatePath("/admin/policies");
    return result.status === "READY"
      ? { success: result.message, documentId: result.documentId }
      : { error: result.message, documentId: result.documentId };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export async function retryPolicy(
  _previous: PolicyActionState,
  formData: FormData,
): Promise<PolicyActionState> {
  await requireAdmin();
  const documentId = formData.get("documentId");
  if (typeof documentId !== "string" || !documentId) return { error: "Select a policy to retry." };

  try {
    const tenant = await getAdminTenant();
    const result = await indexPolicyDocument(tenant.id, documentId);
    revalidatePath("/admin/policies");
    return result.status === "READY"
      ? { success: result.message, documentId: result.documentId }
      : { error: result.message, documentId: result.documentId };
  } catch (error) {
    return { error: errorMessage(error), documentId };
  }
}
