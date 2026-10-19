export type AuthenticatedTenantContext = {
  /**
   * This value must come from server-side authentication or a trusted job.
   * Browser-provided tenant IDs must never be converted into this type.
   */
  tenantId: string;
};

export function createTrustedTenantContext(tenantId: string): AuthenticatedTenantContext {
  const normalizedTenantId = tenantId.trim();
  if (!normalizedTenantId) {
    throw new Error("A server-resolved tenant ID is required.");
  }

  return { tenantId: normalizedTenantId };
}
