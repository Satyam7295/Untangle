import { describe, expect, it } from "vitest";

import { getDatabaseUrl } from "./env";

describe("getDatabaseUrl", () => {
  it("returns a configured database URL", () => {
    expect(getDatabaseUrl({ DATABASE_URL: " postgres://localhost/untangle " })).toBe(
      "postgres://localhost/untangle",
    );
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
