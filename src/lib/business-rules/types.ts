import type { RuleAction, RuleCondition, RuleField, RuleOperator } from "../configuration-validation";

export type RuntimeContext = {
  categoryId?: string | null;
  subcategoryId?: string | null;
  priorityId?: string | null;
  assignedTeamId?: string | null;
  status?: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "ESCALATED" | null;
};

export type StoredBusinessRule = {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  precedence: number;
  conditionMode: "ALL" | "ANY";
  conditions: unknown;
  actions: unknown;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
};

export type ConditionEvaluation = {
  field: RuleField;
  operator: RuleOperator;
  expectedValue?: string | string[];
  matched: boolean;
};

export type RuleEvaluation = {
  ruleId: string;
  ruleName: string;
  precedence: number;
  matched: boolean;
  conditions: ConditionEvaluation[];
  validationError?: string;
};

export type ProposedAction = RuleAction & {
  ruleId: string;
  ruleName: string;
  precedence: number;
};

export type ActionConflict = {
  domain: RuleAction["type"];
  actions: ProposedAction[];
};

export type DecisionResult = {
  evaluationId: string;
  evaluatedAt: string;
  status: "VALID" | "INVALID_CONTEXT";
  recommendation: "APPLY" | "NO_MATCH" | "HUMAN_REVIEW";
  matchedRules: RuleEvaluation[];
  nonMatchingRules: RuleEvaluation[];
  proposedActions: ProposedAction[];
  conflicts: ActionConflict[];
  validationErrors: string[];
};

export type ConditionInput = RuleCondition;
