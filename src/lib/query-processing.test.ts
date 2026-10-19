import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadAndEvaluateBusinessRules: vi.fn(),
  transaction: vi.fn(),
  ticketCreate: vi.fn(),
  priorityFindUnique: vi.fn(),
  teamFindUnique: vi.fn(),
  categoryFindUnique: vi.fn(),
}));

vi.mock("./business-rules/repository", () => ({
  loadAndEvaluateBusinessRules: mocks.loadAndEvaluateBusinessRules,
}));
vi.mock("./prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));

import { parseSupportQuery, processSupportQuery } from "./query-processing";

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

const decision = (overrides: Record<string, unknown> = {}) => ({
  evaluationId: "evaluation-1",
  evaluatedAt: "2026-01-01T00:00:00.000Z",
  status: "VALID" as const,
  recommendation: "APPLY" as const,
  matchedRules: [{ ruleId: "rule-1", ruleName: "Route open work", precedence: 1, matched: true, conditions: [] }],
  nonMatchingRules: [],
  proposedActions: [{ type: "SET_PRIORITY" as const, value: "priority-1", ruleId: "rule-1", ruleName: "Route open work", precedence: 1 }],
  conflicts: [],
  validationErrors: [],
  ...overrides,
});

describe("support query processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadAndEvaluateBusinessRules.mockResolvedValue(decision());
    mocks.priorityFindUnique.mockResolvedValue({ id: "priority-1", isActive: true });
    mocks.teamFindUnique.mockResolvedValue({ id: "team-1", isActive: true });
    mocks.categoryFindUnique.mockResolvedValue({ id: "category-1", isActive: true });
    mocks.ticketCreate.mockResolvedValue({ id: "ticket-1", referenceNumber: "T-1" });
    mocks.transaction.mockImplementation(async (callback) => callback({
      ticket: { create: mocks.ticketCreate },
      priorityLevel: { findUnique: mocks.priorityFindUnique },
      team: { findUnique: mocks.teamFindUnique },
      category: { findUnique: mocks.categoryFindUnique },
    }));
  });

  it("validates the query and persists a safe deterministic decision", async () => {
    const result = await processSupportQuery(form({ query: "My delivery is late." }));
    expect(result).toMatchObject({ persisted: true, ticket: { referenceNumber: "T-1" } });
    expect(mocks.loadAndEvaluateBusinessRules).toHaveBeenCalledWith({ status: "OPEN" });
    expect(mocks.ticketCreate).toHaveBeenCalled();
  });

  it("persists no-match decisions without proposing actions", async () => {
    mocks.loadAndEvaluateBusinessRules.mockResolvedValue(decision({
      recommendation: "NO_MATCH",
      matchedRules: [],
      proposedActions: [],
    }));
    const result = await processSupportQuery(form({ query: "Something unusual." }));
    expect(result).toMatchObject({ persisted: true, decision: { recommendation: "NO_MATCH" } });
  });

  it("does not execute conflicting actions and requires human review", async () => {
    mocks.loadAndEvaluateBusinessRules.mockResolvedValue(decision({
      recommendation: "HUMAN_REVIEW",
      conflicts: [{ domain: "SET_PRIORITY", actions: [] }],
    }));
    const result = await processSupportQuery(form({ query: "Two teams disagree." }));
    expect(result).toMatchObject({ persisted: true, decision: { recommendation: "HUMAN_REVIEW" } });
    expect(mocks.priorityFindUnique).not.toHaveBeenCalled();
  });

  it("does not execute actions when a malformed rule was isolated", async () => {
    mocks.loadAndEvaluateBusinessRules.mockResolvedValue(decision({
      validationErrors: ["Malformed rule configuration."],
    }));
    const result = await processSupportQuery(form({ query: "A rule is malformed." }));
    expect(result).toMatchObject({ persisted: true, decision: { recommendation: "HUMAN_REVIEW" } });
    expect(mocks.priorityFindUnique).not.toHaveBeenCalled();
  });

  it("rejects invalid query and runtime context before loading rules", async () => {
    expect(parseSupportQuery(form({ query: "" }))).toEqual({
      ok: false,
      error: "Write a support query before submitting.",
    });
    expect(parseSupportQuery(form({ query: "Valid", status: "INVALID" }))).toEqual({
      ok: false,
      error: "status must be a supported ticket status.",
    });
    expect(parseSupportQuery(form({ query: "Valid", context: "{\"expression\":\"true\"}" }))).toEqual({
      ok: false,
      error: "Unsupported runtime fields: expression.",
    });
    expect(mocks.loadAndEvaluateBusinessRules).not.toHaveBeenCalled();
  });
});
