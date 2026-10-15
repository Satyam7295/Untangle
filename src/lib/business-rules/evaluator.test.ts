import { describe, expect, it } from "vitest";

import { evaluateBusinessRules, evaluateCondition, validateRuntimeContext } from "./evaluator";
import type { StoredBusinessRule } from "./types";

const rule = (overrides: Partial<StoredBusinessRule> = {}): StoredBusinessRule => ({
  id: "rule-1",
  name: "Open ticket",
  isActive: true,
  precedence: 10,
  conditionMode: "ALL",
  conditions: [{ field: "status", operator: "EQUALS", value: "OPEN" }],
  actions: [{ type: "SET_PRIORITY", value: "priority-1" }],
  effectiveFrom: null,
  effectiveUntil: null,
  ...overrides,
});

describe("business rule evaluator", () => {
  it("validates the supported runtime shape and rejects executable or unknown fields", () => {
    expect(validateRuntimeContext({ status: "OPEN", priorityId: "priority-1" }).ok).toBe(true);
    expect(validateRuntimeContext({ status: "OPEN", expression: "true" }).ok).toBe(false);
    expect(validateRuntimeContext({ status: "UNKNOWN" }).ok).toBe(false);
  });

  it("evaluates supported scalar, list, text, numeric, and empty operators", () => {
    const context = { status: "OPEN" as const, priorityId: "5" };
    expect(evaluateCondition({ field: "status", operator: "EQUALS", value: "OPEN" }, context).matched).toBe(true);
    expect(evaluateCondition({ field: "status", operator: "NOT_EQUALS", value: "CLOSED" }, context).matched).toBe(true);
    expect(evaluateCondition({ field: "status", operator: "CONTAINS", value: "P" }, context).matched).toBe(true);
    expect(evaluateCondition({ field: "status", operator: "NOT_CONTAINS", value: "X" }, context).matched).toBe(true);
    expect(evaluateCondition({ field: "status", operator: "IN", value: ["OPEN", "CLOSED"] }, context).matched).toBe(true);
    expect(evaluateCondition({ field: "status", operator: "NOT_IN", value: ["CLOSED"] }, context).matched).toBe(true);
    expect(evaluateCondition({ field: "priorityId", operator: "GREATER_THAN", value: "3" }, context).matched).toBe(true);
    expect(evaluateCondition({ field: "priorityId", operator: "LESS_THAN_OR_EQUAL", value: "5" }, context).matched).toBe(true);
    expect(evaluateCondition({ field: "categoryId", operator: "IS_EMPTY" }, {}).matched).toBe(true);
    expect(evaluateCondition({ field: "categoryId", operator: "IS_NOT_EMPTY" }, {}).matched).toBe(false);
  });

  it("supports ALL and ANY and keeps malformed rules isolated", () => {
    const result = evaluateBusinessRules(
      { status: "OPEN" },
      [
        rule(),
        rule({ id: "rule-2", name: "Malformed", conditions: [{ field: "unsupported" }] }),
        rule({ id: "rule-3", name: "Any", conditionMode: "ANY", conditions: [
          { field: "status", operator: "EQUALS", value: "CLOSED" },
          { field: "status", operator: "EQUALS", value: "OPEN" },
        ] }),
      ],
      new Date("2026-01-01T00:00:00.000Z"),
    );
    expect(result.matchedRules.map((item) => item.ruleId)).toEqual(["rule-1", "rule-3"]);
    expect(result.validationErrors).toHaveLength(1);
    expect(result.proposedActions).toHaveLength(2);
  });

  it("orders ties by id and reports conflicting actions for human review", () => {
    const result = evaluateBusinessRules({ status: "OPEN" }, [
      rule({ id: "b", actions: [{ type: "SET_PRIORITY", value: "p2" }] }),
      rule({ id: "a", actions: [{ type: "SET_PRIORITY", value: "p1" }] }),
    ]);
    expect(result.matchedRules.map((item) => item.ruleId)).toEqual(["a", "b"]);
    expect(result.recommendation).toBe("HUMAN_REVIEW");
    expect(result.conflicts[0]?.domain).toBe("SET_PRIORITY");
  });

  it("returns a safe result for invalid context without evaluating rules", () => {
    const result = evaluateBusinessRules({ status: "INVALID" }, [rule()]);
    expect(result.status).toBe("INVALID_CONTEXT");
    expect(result.recommendation).toBe("HUMAN_REVIEW");
    expect(result.matchedRules).toEqual([]);
  });
});
