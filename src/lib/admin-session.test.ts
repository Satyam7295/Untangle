import { describe, expect, it } from "vitest";

import {
  ADMIN_SESSION_MAX_AGE,
  createAdminSession,
  isValidAdminSession,
} from "./admin-session";

const secret = "fictional-test-secret-that-is-long-enough";
const now = Date.UTC(2026, 0, 1);

describe("admin sessions", () => {
  it("creates a session accepted with the same secret", () => {
    const session = createAdminSession(secret, now);

    expect(isValidAdminSession(session, secret, now)).toBe(true);
  });

  it("rejects missing, tampered, and differently signed sessions", () => {
    const session = createAdminSession(secret, now);

    expect(isValidAdminSession(undefined, secret, now)).toBe(false);
    expect(isValidAdminSession(`${session}tampered`, secret, now)).toBe(false);
    expect(isValidAdminSession(session, `${secret}-different`, now)).toBe(false);
  });

  it("rejects expired sessions", () => {
    const session = createAdminSession(secret, now);

    expect(
      isValidAdminSession(session, secret, now + (ADMIN_SESSION_MAX_AGE + 1) * 1000),
    ).toBe(false);
  });
});
