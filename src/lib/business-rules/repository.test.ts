import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("../prisma", () => ({ prisma: { businessRule: { findMany: mocks.findMany } } }));

import { businessRuleRepository } from "./repository";

describe("business rule repository", () => {
  it("loads only eligible rules with an exclusive end and stable ordering", async () => {
    mocks.findMany.mockResolvedValue([]);
    const evaluatedAt = new Date("2026-01-01T00:00:00.000Z");

    await businessRuleRepository.loadEligibleRules(evaluatedAt);

    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        isActive: true,
        OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: evaluatedAt } }],
        AND: [{ OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: evaluatedAt } }] }],
      },
      orderBy: [{ precedence: "asc" }, { id: "asc" }],
    }));
  });
});
