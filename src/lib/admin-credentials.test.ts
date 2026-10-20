import { describe, expect, it } from "vitest";

import { verifyAdminCredentials } from "./admin-credentials";

const configuration = {
  id: "admin@example.test",
  password: "fictional-password",
  sessionSecret: "fictional-test-secret-that-is-long-enough",
  tenantId: "tenant-a",
};

describe("verifyAdminCredentials", () => {
  it("accepts the configured administrator credentials", () => {
    expect(verifyAdminCredentials(configuration.id, configuration.password, configuration)).toBe(
      true,
    );
  });

  it("rejects an invalid administrator ID", () => {
    expect(verifyAdminCredentials("other@example.test", configuration.password, configuration)).toBe(
      false,
    );
  });

  it("rejects an invalid password", () => {
    expect(verifyAdminCredentials(configuration.id, "wrong-password", configuration)).toBe(false);
  });
});
