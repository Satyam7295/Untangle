"use server";

import { redirect } from "next/navigation";

import { clearSupportSession } from "../../src/lib/admin-auth";

export async function logoutSupport(): Promise<void> {
  await clearSupportSession();
  redirect("/support/login");
}
