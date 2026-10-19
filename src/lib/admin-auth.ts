import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  ADMIN_SESSION_COOKIE,
  createAdminSession,
  isValidAdminSession,
} from "./admin-session";
import { getSessionSecret } from "./env";

export async function isAdminAuthenticated(): Promise<boolean> {
  const sessionSecret = getSessionSecret();
  const cookieStore = await cookies();
  return isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value, sessionSecret);
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }
}

export async function setAdminSession(): Promise<void> {
  const sessionSecret = getSessionSecret();
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, createAdminSession(sessionSecret), {
    httpOnly: true,
    maxAge: 8 * 60 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}
