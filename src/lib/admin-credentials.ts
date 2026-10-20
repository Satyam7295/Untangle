import { createHash, timingSafeEqual } from "node:crypto";

import { getAdminCredentials, type AdminCredentials } from "./env";

function securelyEquals(left: string, right: string): boolean {
  const leftDigest = createHash("sha256").update(left, "utf8").digest();
  const rightDigest = createHash("sha256").update(right, "utf8").digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

export function verifyAdminCredentials(
  id: string,
  password: string,
  configuration: AdminCredentials = getAdminCredentials(),
): boolean {
  return (
    securelyEquals(id, configuration.id) &&
    securelyEquals(password, configuration.password)
  );
}
