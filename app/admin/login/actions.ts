"use server";

import { redirect } from "next/navigation";

import { verifyAdminCredentials } from "../../../src/lib/admin-credentials";
import { setAdminSession } from "../../../src/lib/admin-auth";

export type LoginState = {
  error?: string;
};

export async function loginAdmin(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const id = formData.get("id");
  const password = formData.get("password");

  if (typeof id !== "string" || typeof password !== "string" || !id || !password) {
    return { error: "Enter your administrator ID and password." };
  }

  if (!verifyAdminCredentials(id, password)) {
    return { error: "Invalid administrator ID or password." };
  }

  await setAdminSession();
  redirect("/admin");
}
