import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  businessRule: {
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  category: { findUnique: vi.fn() },
  subcategory: { findUnique: vi.fn() },
  priorityLevel: { findUnique: vi.fn() },
  team: { findUnique: vi.fn() },
}));

vi.mock("../../../src/lib/admin-auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("../../../src/lib/prisma", () => ({ prisma: mocks }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { saveRule } from "./actions";

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

const validValues = {
  name: "Urgent routing",
  description: "Route urgent requests",
  conditionMode: "ALL",
  conditions: JSON.stringify([{ field: "status", operator: "EQUALS", value: "OPEN" }]),
  actions: JSON.stringify([{ type: "ESCALATE", value: "1" }]),
  precedence: "10",
  isActive: "true",
  effectiveFrom: "2026-02-01T10:00",
  effectiveUntil: "2026-02-01T11:00",
};

describe("business rule mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(undefined);
    mocks.businessRule.create.mockResolvedValue({});
    mocks.businessRule.updateMany.mockResolvedValue({ count: 1 });
  });

  it("authenticates before parsing or touching Prisma", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("redirect"));

    await expect(saveRule({}, form(validValues))).rejects.toThrow("redirect");
    expect(mocks.businessRule.create).not.toHaveBeenCalled();
  });

  it("persists a validated rule with UTC effective dates", async () => {
    const result = await saveRule({}, form(validValues));

    expect(result).toEqual({ success: "Rule created." });
    expect(mocks.businessRule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Urgent routing",
        effectiveFrom: new Date("2026-02-01T10:00:00.000Z"),
        effectiveUntil: new Date("2026-02-01T11:00:00.000Z"),
      }),
    });
  });

  it("does not silently overwrite a stale edit", async () => {
    mocks.businessRule.updateMany.mockResolvedValue({ count: 0 });

    const result = await saveRule({}, form({ ...validValues, id: "rule-1", updatedAt: "2026-02-01T09:00:00.000Z" }));

    expect(result).toEqual({ error: "This rule changed elsewhere. Refresh before saving your changes." });
    expect(mocks.businessRule.updateMany).toHaveBeenCalledOnce();
  });

  it("rejects malformed structured payloads before persistence", async () => {
    const result = await saveRule({}, form({ ...validValues, conditions: "{not-json" }));

    expect(result).toEqual({ error: "Conditions and actions must be valid structured data." });
    expect(mocks.businessRule.create).not.toHaveBeenCalled();
  });
});
