import { prisma } from "../prisma";
import { evaluateBusinessRules } from "./evaluator";
import type { StoredBusinessRule } from "./types";

export type BusinessRuleRepository = {
  loadEligibleRules(evaluatedAt: Date): Promise<StoredBusinessRule[]>;
};

export const businessRuleRepository: BusinessRuleRepository = {
  async loadEligibleRules(evaluatedAt) {
    return prisma.businessRule.findMany({
      where: {
        isActive: true,
        OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: evaluatedAt } }],
        AND: [{ OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: evaluatedAt } }] }],
      },
      orderBy: [{ precedence: "asc" }, { id: "asc" }],
      select: {
        id: true, name: true, description: true, isActive: true, precedence: true,
        conditionMode: true, conditions: true, actions: true, effectiveFrom: true, effectiveUntil: true,
      },
    }) as Promise<StoredBusinessRule[]>;
  },
};

export async function loadAndEvaluateBusinessRules(
  context: unknown,
  evaluatedAt = new Date(),
  repository: BusinessRuleRepository = businessRuleRepository,
) {
  const rules = await repository.loadEligibleRules(evaluatedAt);
  return evaluateBusinessRules(context, rules, evaluatedAt);
}
