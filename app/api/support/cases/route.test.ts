import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isSupportAuthenticated: vi.fn(),
  listSupportCases: vi.fn(),
}));

vi.mock("../../../../src/lib/admin-auth", () => ({
  isSupportAuthenticated: mocks.isSupportAuthenticated,
}));
vi.mock("../../../../src/lib/support-cases", () => ({
  listSupportCases: mocks.listSupportCases,
}));

import { GET } from "./route";

describe("support cases API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies unauthenticated requests", async () => {
    mocks.isSupportAuthenticated.mockResolvedValue(false);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.listSupportCases).not.toHaveBeenCalled();
  });

  it("returns escalated cases to support users", async () => {
    mocks.isSupportAuthenticated.mockResolvedValue(true);
    mocks.listSupportCases.mockResolvedValue([{
      id: "case-1",
      referenceNumber: "T-1",
      originalQuery: "Question",
      status: "ESCALATED",
      priority: { name: "High", severity: 3 },
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-02"),
      messages: [{ createdAt: new Date("2026-01-03") }],
    }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.cases[0]).toMatchObject({
      id: "case-1",
      originalQuery: "Question",
      latestActivity: "2026-01-03T00:00:00.000Z",
    });
  });
});
