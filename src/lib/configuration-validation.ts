export const MAX_NAME_LENGTH = 100;
export const MAX_SLUG_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 1000;
export const MAX_SEVERITY = 1000;
export const MAX_RULE_PRECEDENCE = 1000000;

export const RULE_FIELDS = ["categoryId", "subcategoryId", "priorityId", "assignedTeamId", "status"] as const;
export const RULE_ACTION_TYPES = ["SET_PRIORITY", "ASSIGN_TEAM", "SET_CATEGORY", "ESCALATE"] as const;
export const RULE_OPERATORS = [
  "EQUALS", "NOT_EQUALS", "CONTAINS", "NOT_CONTAINS", "IN", "NOT_IN",
  "GREATER_THAN", "LESS_THAN", "GREATER_THAN_OR_EQUAL", "LESS_THAN_OR_EQUAL",
  "IS_EMPTY", "IS_NOT_EMPTY",
] as const;

export type RuleField = (typeof RULE_FIELDS)[number];
export type RuleOperator = (typeof RULE_OPERATORS)[number];
export type RuleActionType = (typeof RULE_ACTION_TYPES)[number];
export type RuleCondition = { field: RuleField; operator: RuleOperator; value?: string | string[] };
export type RuleAction = { type: RuleActionType; value: string };
export type RuleConfiguration = {
  name: string;
  description: string;
  conditionMode: "ALL" | "ANY";
  conditions: RuleCondition[];
  actions: RuleAction[];
  precedence: number;
  isActive: boolean;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
};
export type RuleValidationResult =
  | { ok: true; value: RuleConfiguration }
  | { ok: false; error: string };

export type ValidationResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

export function normalizeText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH);
}

export function validateName(value: string): ValidationResult {
  if (!value) return { ok: false, error: "Name is required." };
  if (value.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` };
  }
  return { ok: true, value };
}

export function validateDescription(value: string): ValidationResult {
  if (value.length > MAX_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`,
    };
  }
  return { ok: true, value };
}

export function validateSlug(value: string, fallback: string): ValidationResult {
  const slug = slugify(value || fallback);
  if (!slug) return { ok: false, error: "Enter a name that can be converted to a URL-safe slug." };
  if (slug.length > MAX_SLUG_LENGTH) {
    return { ok: false, error: `Slug must be ${MAX_SLUG_LENGTH} characters or fewer.` };
  }
  return { ok: true, value: slug };
}

export function parseSeverity(value: string): { ok: true; value: number } | { ok: false; error: string } {
  if (!/^\d+$/.test(value)) return { ok: false, error: "Severity must be a whole number." };
  const severity = Number(value);
  if (severity < 0 || severity > MAX_SEVERITY) {
    return { ok: false, error: `Severity must be between 0 and ${MAX_SEVERITY}.` };
  }
  return { ok: true, value: severity };
}

const TEXT_OPERATORS = new Set<RuleOperator>(["EQUALS", "NOT_EQUALS", "CONTAINS", "NOT_CONTAINS", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"]);
const NUMERIC_OPERATORS = new Set<RuleOperator>(["EQUALS", "NOT_EQUALS", "GREATER_THAN", "LESS_THAN", "GREATER_THAN_OR_EQUAL", "LESS_THAN_OR_EQUAL"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRuleDate(value: unknown): Date | null {
  if (value === null) return null;
  const text = String(value);
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/.test(text) ? text : `${text}Z`;
  return new Date(normalized);
}

export function validateRuleConfiguration(input: unknown): RuleValidationResult {
    if (!isRecord(input)) return { ok: false, error: "Rule configuration must be an object." };
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const description = typeof input.description === "string" ? input.description.trim() : "";
    const nameResult = validateName(name);
    if (!nameResult.ok) return { ok: false, error: nameResult.error };
    const descriptionResult = validateDescription(description);
    if (!descriptionResult.ok) return descriptionResult;
    if (input.conditionMode !== "ALL" && input.conditionMode !== "ANY") return { ok: false, error: "Choose ALL or ANY condition matching." };
    if (!Array.isArray(input.conditions) || input.conditions.length === 0) return { ok: false, error: "Add at least one condition." };
    if (!Array.isArray(input.actions) || input.actions.length === 0) return { ok: false, error: "Add at least one action." };

    const conditions: RuleCondition[] = [];
    for (const condition of input.conditions) {
      if (!isRecord(condition) || !RULE_FIELDS.includes(condition.field as RuleField) || !RULE_OPERATORS.includes(condition.operator as RuleOperator)) {
        return { ok: false, error: "Each condition must use a supported field and operator." };
      }
      const field = condition.field as RuleField;
      const operator = condition.operator as RuleOperator;
      const allowed = field === "priorityId" ? NUMERIC_OPERATORS : TEXT_OPERATORS;
      if (!allowed.has(operator)) return { ok: false, error: `The ${operator} operator is not valid for ${field}.` };
      if (operator !== "IS_EMPTY" && operator !== "IS_NOT_EMPTY") {
        const value = condition.value;
        if (operator === "IN" || operator === "NOT_IN") {
          if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || !item.trim())) return { ok: false, error: "List conditions require one or more values." };
          conditions.push({ field, operator, value: value.map((item) => item.trim()) });
        } else if (typeof value !== "string" || !value.trim()) {
          return { ok: false, error: "Each condition requires a value." };
        } else {
          conditions.push({ field, operator, value: value.trim() });
        }
      } else {
        conditions.push({ field, operator });
      }
    }

    const actions: RuleAction[] = [];
    for (const action of input.actions) {
      if (!isRecord(action) || !RULE_ACTION_TYPES.includes(action.type as RuleActionType) || typeof action.value !== "string" || !action.value.trim()) {
        return { ok: false, error: "Each action requires a supported type and value." };
      }
      actions.push({ type: action.type as RuleActionType, value: action.value.trim() });
    }

    if (!Number.isInteger(input.precedence) || (input.precedence as number) < 0 || (input.precedence as number) > MAX_RULE_PRECEDENCE) {
      return { ok: false, error: `Precedence must be a whole number between 0 and ${MAX_RULE_PRECEDENCE}.` };
    }
    const effectiveFrom = parseRuleDate(input.effectiveFrom);
    const effectiveUntil = parseRuleDate(input.effectiveUntil);
    if ((effectiveFrom && Number.isNaN(effectiveFrom.getTime())) || (effectiveUntil && Number.isNaN(effectiveUntil.getTime()))) return { ok: false, error: "Enter valid effective dates." };
    if (effectiveFrom && effectiveUntil && effectiveUntil <= effectiveFrom) return { ok: false, error: "The effective end must be later than the start." };
    if (typeof input.isActive !== "boolean") return { ok: false, error: "Choose an activation status." };

    return { ok: true, value: { name, description, conditionMode: input.conditionMode, conditions, actions, precedence: input.precedence as number, isActive: input.isActive, effectiveFrom, effectiveUntil } };
}
