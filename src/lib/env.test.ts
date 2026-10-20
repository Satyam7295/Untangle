import { describe, expect, it } from "vitest";

import {
  getAdminConfiguration,
  getAdminCredentials,
  getDatabaseUrl,
  getPolicyTenantId,
  getSessionSecret,
} from "./env";

describe("getDatabaseUrl", () => {
  it("returns a configured database URL", () => {
    expect(getDatabaseUrl({ DATABASE_URL: " postgres://localhost/untangle " })).toBe(
      "postgres://localhost/untangle",
    );
  });

  describe("getAdminConfiguration", () => {
    const validConfiguration = {
      ADMIN_ID: "admin@example.test",
      ADMIN_PASSWORD: "fictional-password",
      SESSION_SECRET: "a".repeat(32),
      ADMIN_TENANT_ID: "tenant-a",
    };

    it("returns configured credentials without changing their exact values", () => {
      expect(getAdminConfiguration(validConfiguration)).toEqual({
        id: "admin@example.test",
        password: "fictional-password",
        sessionSecret: "a".repeat(32),
        tenantId: "tenant-a",
      });
    });

    it("rejects missing configuration", () => {
      expect(() => getAdminConfiguration({})).toThrow("ADMIN_TENANT_ID");
    });

    it("rejects a short session secret", () => {
      expect(() =>
        getAdminConfiguration({ ...validConfiguration, SESSION_SECRET: "too-short" }),
      ).toThrow("SESSION_SECRET must be at least 32 characters");
    });
  });

  describe("admin authentication configuration", () => {
    it("loads credentials without requiring a tenant", () => {
      expect(getAdminCredentials({
        ADMIN_ID: "admin@example.test",
        ADMIN_PASSWORD: "fictional-password",
      })).toEqual({
        id: "admin@example.test",
        password: "fictional-password",
      });
    });

    it("loads a valid session secret without requiring a tenant", () => {
      expect(getSessionSecret({ SESSION_SECRET: "a".repeat(32) })).toBe("a".repeat(32));
    });
  });

  it("throws an actionable error when the URL is missing", () => {
    expect(() => getDatabaseUrl({})).toThrow(
      "DATABASE_URL is not configured. Copy .env.example to .env.local",
    );
  });

  it("rejects a blank URL", () => {
    expect(() => getDatabaseUrl({ DATABASE_URL: "  " })).toThrow("DATABASE_URL is not configured");
  });

  it("loads the policy tenant without requiring admin credentials", () => {
    expect(getPolicyTenantId({ ADMIN_TENANT_ID: " tenant-a " })).toBe("tenant-a");
    expect(() => getPolicyTenantId({})).toThrow("ADMIN_TENANT_ID");
  });
});
