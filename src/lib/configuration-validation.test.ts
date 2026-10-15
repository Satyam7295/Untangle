import { describe, expect, it } from "vitest";

import {
  parseSeverity,
  slugify,
  validateDescription,
  validateName,
  validateSlug,
  validateRuleConfiguration,
} from "./configuration-validation";

describe("configuration validation", () => {
  it("creates stable URL-safe slugs from names", () => {
    expect(slugify("  Customer Support & Billing  ")).toBe("customer-support-billing");
    const result = validateSlug("", "Customer Support");
    expect(result.ok && result.value).toBe("customer-support");
  });

  it("rejects missing or oversized names and descriptions", () => {
    expect(validateName("")).toEqual({ ok: false, error: "Name is required." });
    expect(validateName("x".repeat(101)).ok).toBe(false);
    expect(validateDescription("x".repeat(1001)).ok).toBe(false);
  });

  it("accepts whole-number severity values within the supported range", () => {
    expect(parseSeverity("5")).toEqual({ ok: true, value: 5 });
    expect(parseSeverity("1.5").ok).toBe(false);
    expect(parseSeverity("-1").ok).toBe(false);
    expect(parseSeverity("1001").ok).toBe(false);
  });

  it("validates typed rule conditions, actions, and date ranges", () => {
    const valid = validateRuleConfiguration({
      name: "Urgent billing",
      description: "Route urgent billing requests",
      conditionMode: "ALL",
      conditions: [{ field: "priorityId", operator: "GREATER_THAN", value: "3" }],
      actions: [{ type: "ASSIGN_TEAM", value: "team-id" }],
      precedence: 10,
      isActive: true,
      effectiveFrom: "2026-01-01T00:00:00Z",
      effectiveUntil: null,
    });
    expect(valid.ok).toBe(true);
    expect(validateRuleConfiguration({
      name: "Invalid",
      description: "",
      conditionMode: "ALL",
      conditions: [{ field: "categoryId", operator: "GREATER_THAN", value: "3" }],
      actions: [{ type: "ADD_TAG", value: "urgent" }],
      precedence: 1,
      isActive: true,
      effectiveFrom: null,
      effectiveUntil: null,
    }).ok).toBe(false);
    expect(validateRuleConfiguration({
      name: "Bad dates",
      description: "",
      conditionMode: "ANY",
      conditions: [{ field: "status", operator: "EQUALS", value: "OPEN" }],
      actions: [{ type: "ESCALATE", value: "1" }],
      precedence: 1,
      isActive: true,
      effectiveFrom: "2026-02-01T00:00:00Z",
      effectiveUntil: "2026-01-01T00:00:00Z",
    }).ok).toBe(false);
  });

  it("treats datetime-local rule dates as UTC", () => {
    const result = validateRuleConfiguration({
      name: "UTC schedule",
      description: "",
      conditionMode: "ALL",
      conditions: [{ field: "status", operator: "EQUALS", value: "OPEN" }],
      actions: [{ type: "ESCALATE", value: "1" }],
      precedence: 1,
      isActive: true,
      effectiveFrom: "2026-02-01T10:00",
      effectiveUntil: "2026-02-01T11:00",
    });

    expect(result.ok && result.value.effectiveFrom?.toISOString()).toBe("2026-02-01T10:00:00.000Z");
    expect(result.ok && result.value.effectiveUntil?.toISOString()).toBe("2026-02-01T11:00:00.000Z");
  });
});
