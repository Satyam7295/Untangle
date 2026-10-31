import { describe, expect, it } from "vitest";

import { verifySupportCredentials } from "./support-credentials";

describe("support credentials", () => {
  const environment = { SUPPORT_ID: "support", SUPPORT_PASSWORD: "secret" };

  it("accepts exact configured credentials", () => {
    expect(verifySupportCredentials("support", "secret", environment)).toBe(true);
  });

  it("rejects incorrect credentials and missing configuration", () => {
    expect(verifySupportCredentials("support", "wrong", environment)).toBe(false);
    expect(() => verifySupportCredentials("support", "secret", {})).toThrow();
  });
});
