"use server";

import { redirect } from "next/navigation";

import { clearAdminSession } from "../../src/lib/admin-auth";

export async function logoutAdmin(): Promise<void> {
  await clearAdminSession();
  redirect("/admin/login");
}
