import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "untangle_admin_session";
export const ADMIN_SESSION_MAX_AGE = 8 * 60 * 60;

type SessionPayload = {
  sub: "admin";
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

export function createAdminSession(secret: string, now = Date.now()): string {
  const payload: SessionPayload = {
    sub: "admin",
    exp: Math.floor(now / 1000) + ADMIN_SESSION_MAX_AGE,
  };
  const encodedPayload = encode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function isValidAdminSession(
  token: string | undefined,
  secret: string,
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
      payload.sub === "admin" &&
      typeof payload.exp === "number" &&
      payload.exp > Math.floor(now / 1000)
    );
  } catch {
    return false;
  }
}
