import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { redirect } from "next/navigation";
import AdminPage from "./page";

describe("protected admin entry", () => {
  it("redirects unauthenticated visitors to sign-in without rendering admin content", () => {
    AdminPage();
    expect(redirect).toHaveBeenCalledWith("/admin/login");
  });
});
