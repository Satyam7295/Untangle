import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPolicyTenantId: vi.fn(() => "tenant-a"),
  findFirst: vi.fn(),
}));

vi.mock("../../../src/lib/env", () => ({ getPolicyTenantId: mocks.getPolicyTenantId }));
vi.mock("../../../src/lib/prisma", () => ({ prisma: { policyDocument: { findFirst: mocks.findFirst } } }));

import { GET } from "./route";

describe("policy status route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPolicyTenantId.mockReturnValue("tenant-a");
  });

  it("returns the configured tenant's active policy status", async () => {
    mocks.findFirst.mockResolvedValue({ fileName: "leave.pdf", indexingStatus: "READY" });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "READY", fileName: "leave.pdf" });
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: "tenant-a", isActive: true },
    }));
  });

  it("reports an unconfigured tenant without exposing configuration details", async () => {
    mocks.getPolicyTenantId.mockImplementation(() => {
      throw new Error("DATABASE_URL=private");
    });

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "UNAVAILABLE",
      message: "Policy search is not configured.",
    });
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
});
