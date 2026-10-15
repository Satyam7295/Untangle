import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/admin-auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("./actions", () => ({ logoutAdmin: vi.fn() }));

import { requireAdmin } from "../../src/lib/admin-auth";
import AdminPage from "./page";

describe("protected admin entry", () => {
  it("checks authentication before rendering admin content", async () => {
    await AdminPage();
    expect(requireAdmin).toHaveBeenCalledOnce();
  });
});
