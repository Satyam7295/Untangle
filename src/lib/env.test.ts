import { describe, expect, it } from "vitest";

import { getAdminConfiguration, getDatabaseUrl } from "./env";

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
    };

    it("returns configured credentials without changing their exact values", () => {
      expect(getAdminConfiguration(validConfiguration)).toEqual({
        id: "admin@example.test",
        password: "fictional-password",
        sessionSecret: "a".repeat(32),
      });
    });

    it("rejects missing configuration", () => {
      expect(() => getAdminConfiguration({})).toThrow("ADMIN_ID, ADMIN_PASSWORD, and SESSION_SECRET");
    });

    it("rejects a short session secret", () => {
      expect(() =>
        getAdminConfiguration({ ...validConfiguration, SESSION_SECRET: "too-short" }),
      ).toThrow("SESSION_SECRET must be at least 32 characters");
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
});
