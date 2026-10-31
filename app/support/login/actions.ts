"use server";

import { redirect } from "next/navigation";

import { setSupportSession } from "../../../src/lib/admin-auth";
import { verifySupportCredentials } from "../../../src/lib/support-credentials";

export type SupportLoginState = { error?: string };

export async function loginSupport(
  _previousState: SupportLoginState,
  formData: FormData,
): Promise<SupportLoginState> {
  const id = formData.get("id");
  const password = formData.get("password");

  if (typeof id !== "string" || typeof password !== "string" || !id || !password) {
    return { error: "Enter your support ID and password." };
  }

  try {
    if (!verifySupportCredentials(id, password)) {
      return { error: "Invalid support ID or password." };
    }
  } catch {
    return { error: "Support sign-in is not configured." };
  }

  await setSupportSession();
  redirect("/support");
}
