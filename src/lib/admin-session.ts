import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "untangle_admin_session";
export const SUPPORT_SESSION_COOKIE = "untangle_support_session";
export const ADMIN_SESSION_MAX_AGE = 8 * 60 * 60;

export type SessionRole = "admin" | "support";

type SessionPayload = {
  sub: SessionRole;
  exp: number;
};

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function createSession(sub: SessionRole, secret: string, now = Date.now()): string {
  const payload: SessionPayload = {
    sub,
    exp: Math.floor(now / 1000) + ADMIN_SESSION_MAX_AGE,
  };
  const encodedPayload = encode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function createAdminSession(secret: string, now = Date.now()): string {
  return createSession("admin", secret, now);
}

export function createSupportSession(secret: string, now = Date.now()): string {
  return createSession("support", secret, now);
}

export function isValidSession(
  token: string | undefined,
  secret: string,
  role: SessionRole,
  now = Date.now(),
): boolean {
  if (!token) return false;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;

  const encodedPayload = token.slice(0, separator);
  const providedSignature = token.slice(separator + 1);
  const expectedSignature = sign(encodedPayload, secret);
  const providedBytes = Buffer.from(providedSignature);
  const expectedBytes = Buffer.from(expectedSignature);

  if (
    providedBytes.length !== expectedBytes.length ||
    !timingSafeEqual(providedBytes, expectedBytes)
  ) {
    return false;
  }

  try {
    const payload = JSON.parse(decode(encodedPayload)) as Partial<SessionPayload>;
    return (
      payload.sub === role &&
      typeof payload.exp === "number" &&
      payload.exp > Math.floor(now / 1000)
    );
  } catch {
    return false;
  }
}

export function isValidAdminSession(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): boolean {
  return isValidSession(token, secret, "admin", now);
}

export function isValidSupportSession(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): boolean {
  return isValidSession(token, secret, "support", now);
}
