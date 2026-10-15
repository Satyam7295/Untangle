import { randomUUID } from "node:crypto";

import {
  RULE_FIELDS,
  validateRuleConfiguration,
  type RuleAction,
  type RuleCondition,
  type RuleField,
} from "../configuration-validation";
import type {
  ActionConflict,
  ConditionEvaluation,
  DecisionResult,
  ProposedAction,
  RuleEvaluation,
  RuntimeContext,
  StoredBusinessRule,
} from "./types";

const STATUS_VALUES = new Set(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", "ESCALATED"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateRuntimeContext(context: unknown): { ok: true; value: RuntimeContext } | { ok: false; errors: string[] } {
  if (!isRecord(context)) return { ok: false, errors: ["Runtime context must be an object."] };
  const unsupported = Object.keys(context).filter((key) => !RULE_FIELDS.includes(key as RuleField));
  if (unsupported.length > 0) return { ok: false, errors: [`Unsupported runtime fields: ${unsupported.join(", ")}.`] };

  const value: RuntimeContext = {};
  const errors: string[] = [];
  for (const field of RULE_FIELDS) {
    const fieldValue = context[field];
    if (fieldValue === undefined || fieldValue === null) {
      value[field] = fieldValue as never;
    } else if (field === "status") {
      if (typeof fieldValue !== "string" || !STATUS_VALUES.has(fieldValue)) errors.push(`${field} must be a supported ticket status.`);
      else value[field] = fieldValue as RuntimeContext["status"];
    } else if (typeof fieldValue !== "string" || !fieldValue.trim()) {
      errors.push(`${field} must be a non-empty string or null.`);
    } else {
      value[field] = fieldValue;
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value };
}

function isEmpty(actual: unknown): boolean {
  return actual === undefined || actual === null || actual === "";
}

function numericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^-?(?:\d+|\d*\.\d+)$/.test(value)) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function evaluateCondition(condition: RuleCondition, context: RuntimeContext): ConditionEvaluation {
  const actual = context[condition.field];
  const expected = condition.value;
  let matched = false;

  if (condition.operator === "IS_EMPTY" || condition.operator === "IS_NOT_EMPTY") {
    matched = condition.operator === "IS_EMPTY" ? isEmpty(actual) : !isEmpty(actual);
  } else if (!isEmpty(actual)) {
    const expectedList = Array.isArray(expected) ? expected : [expected as string];
    switch (condition.operator) {
      case "EQUALS": matched = actual === expected; break;
      case "NOT_EQUALS": matched = actual !== expected; break;
      case "CONTAINS": matched = Array.isArray(actual) ? actual.includes(expected as never) : typeof actual === "string" && actual.includes(expected as string); break;
      case "NOT_CONTAINS": matched = Array.isArray(actual) ? !actual.includes(expected as never) : typeof actual === "string" && !actual.includes(expected as string); break;
      case "IN": matched = expectedList.includes(actual as string); break;
      case "NOT_IN": matched = !expectedList.includes(actual as string); break;
      case "GREATER_THAN":
      case "LESS_THAN":
      case "GREATER_THAN_OR_EQUAL":
      case "LESS_THAN_OR_EQUAL": {
        const actualNumber = numericValue(actual);
        const expectedNumber = numericValue(expected);
        if (actualNumber !== null && expectedNumber !== null) {
          matched = condition.operator === "GREATER_THAN" ? actualNumber > expectedNumber
            : condition.operator === "LESS_THAN" ? actualNumber < expectedNumber
              : condition.operator === "GREATER_THAN_OR_EQUAL" ? actualNumber >= expectedNumber
                : actualNumber <= expectedNumber;
        }
        break;
      }
    }
  }
  return { field: condition.field, operator: condition.operator, ...(expected === undefined ? {} : { expectedValue: expected }), matched };
}

export function evaluateAllConditions(conditions: RuleCondition[], context: RuntimeContext): ConditionEvaluation[] {
  return conditions.map((condition) => evaluateCondition(condition, context));
}

export function evaluateAnyCondition(conditions: RuleCondition[], context: RuntimeContext): ConditionEvaluation[] {
  return conditions.map((condition) => evaluateCondition(condition, context));
}

export function evaluateRule(rule: StoredBusinessRule, context: RuntimeContext): RuleEvaluation {
  const parsed = validateRuleConfiguration({
    name: rule.name,
    description: rule.description ?? "",
    conditionMode: rule.conditionMode,
    conditions: rule.conditions,
    actions: rule.actions,
    precedence: rule.precedence,
    isActive: rule.isActive,
    effectiveFrom: rule.effectiveFrom,
    effectiveUntil: rule.effectiveUntil,
  });
  if (!parsed.ok) {
    return { ruleId: rule.id, ruleName: rule.name, precedence: rule.precedence, matched: false, conditions: [], validationError: parsed.error };
  }
  const conditionResults = parsed.value.conditionMode === "ALL"
    ? evaluateAllConditions(parsed.value.conditions, context)
    : evaluateAnyCondition(parsed.value.conditions, context);
  const matched = parsed.value.conditionMode === "ALL"
    ? conditionResults.every((condition) => condition.matched)
    : conditionResults.some((condition) => condition.matched);
  return { ruleId: rule.id, ruleName: rule.name, precedence: rule.precedence, matched, conditions: conditionResults };
}

function actionDomain(action: RuleAction): RuleAction["type"] {
  return action.type;
}

export function resolveActionConflicts(actions: ProposedAction[]): ActionConflict[] {
  const conflicts: ActionConflict[] = [];
  for (const domain of ["SET_PRIORITY", "ASSIGN_TEAM", "SET_CATEGORY", "ESCALATE"] as const) {
    const domainActions = actions.filter((action) => actionDomain(action) === domain);
    const values = new Set(domainActions.map((action) => action.value));
    if (values.size > 1) conflicts.push({ domain, actions: domainActions });
  }
  return conflicts;
}

export function resolveRulePrecedence(rules: StoredBusinessRule[]): StoredBusinessRule[] {
  return [...rules].sort((a, b) => a.precedence - b.precedence || a.id.localeCompare(b.id));
}

export function evaluateBusinessRules(contextInput: unknown, rules: StoredBusinessRule[], evaluatedAt = new Date()): DecisionResult {
  const context = validateRuntimeContext(contextInput);
  const timestamp = new Date(evaluatedAt);
  if (Number.isNaN(timestamp.getTime())) throw new Error("Evaluation timestamp must be valid.");
  if (!context.ok) {
    return {
      evaluationId: randomUUID(), evaluatedAt: timestamp.toISOString(), status: "INVALID_CONTEXT",
      recommendation: "HUMAN_REVIEW", matchedRules: [], nonMatchingRules: [], proposedActions: [], conflicts: [], validationErrors: context.errors,
    };
  }

  const evaluations = resolveRulePrecedence(rules).map((rule) => evaluateRule(rule, context.value));
  const matchedRules = evaluations.filter((rule) => rule.matched);
  const nonMatchingRules = evaluations.filter((rule) => !rule.matched);
  const proposedActions: ProposedAction[] = [];
  for (const rule of matchedRules) {
    const source = rules.find((item) => item.id === rule.ruleId);
    if (!source) continue;
    const parsed = validateRuleConfiguration({
      name: source.name, description: source.description ?? "", conditionMode: source.conditionMode,
      conditions: source.conditions, actions: source.actions, precedence: source.precedence, isActive: source.isActive,
      effectiveFrom: source.effectiveFrom, effectiveUntil: source.effectiveUntil,
    });
    if (parsed.ok) parsed.value.actions.forEach((action) => proposedActions.push({ ...action, ruleId: rule.ruleId, ruleName: rule.ruleName, precedence: rule.precedence }));
  }
  const conflicts = resolveActionConflicts(proposedActions);
  const validationErrors = nonMatchingRules.flatMap((rule) => rule.validationError ? [`${rule.ruleName}: ${rule.validationError}`] : []);
  return {
    evaluationId: randomUUID(), evaluatedAt: timestamp.toISOString(), status: "VALID",
    recommendation: conflicts.length > 0 ? "HUMAN_REVIEW" : matchedRules.length > 0 ? "APPLY" : "NO_MATCH",
    matchedRules, nonMatchingRules, proposedActions, conflicts, validationErrors,
  };
}
