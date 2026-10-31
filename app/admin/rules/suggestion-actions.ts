"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "../../../src/lib/admin-auth";
import { getAdminConfiguration } from "../../../src/lib/env";
import { prisma } from "../../../src/lib/prisma";
import { validateRuleConfiguration } from "../../../src/lib/configuration-validation";

export type SuggestionActionState = { error?: string; success?: string };

export async function reviewRuleSuggestion(
  _previous: SuggestionActionState,
  formData: FormData,
): Promise<SuggestionActionState> {
  await requireAdmin();
  const id = typeof formData.get("id") === "string" ? String(formData.get("id")).trim() : "";
  const decision = formData.get("decision");
  if (!id || (decision !== "APPROVED" && decision !== "REJECTED")) return { error: "A valid suggestion decision is required." };
  const tenantId = getAdminConfiguration().tenantId;

  try {
    const suggestion = await prisma.documentRuleSuggestion.findFirst({ where: { id, tenantId, status: "PENDING" } });
    if (!suggestion) return { error: "The suggestion is unavailable or has already been reviewed." };
    if (decision === "REJECTED") {
      await prisma.$transaction(async (transaction) => {
        await transaction.documentRuleSuggestion.update({ where: { id }, data: { status: "REJECTED", reviewedAt: new Date() } });
        await transaction.auditEvent.create({ data: { eventType: "RULE_SUGGESTION_REJECTED", entityType: "DocumentRuleSuggestion", entityId: id } });
      });
      revalidatePath("/admin/rules");
      return { success: "Suggestion rejected." };
    }

    const configuration = validateRuleConfiguration({
      name: `Policy suggestion ${id.slice(0, 8)}`,
      description: `Approved from policy statement: ${suggestion.statement.slice(0, 900)}`,
      conditionMode: "ALL",
      conditions: suggestion.proposedConditions,
      actions: suggestion.proposedActions,
      precedence: 100,
      isActive: true,
      effectiveFrom: null,
      effectiveUntil: null,
    });
    if (!configuration.ok) return { error: `Review and configure this suggestion before approval: ${configuration.error}` };
    if (configuration.value.conditions.length === 0 || configuration.value.actions.length === 0) {
      return { error: "This statement does not contain enough explicit structured information to approve safely." };
    }

    await prisma.$transaction(async (transaction) => {
      const rule = await transaction.businessRule.create({
        data: {
          name: configuration.value.name,
          description: configuration.value.description,
          conditionMode: configuration.value.conditionMode,
          conditions: configuration.value.conditions as Prisma.InputJsonValue,
          actions: configuration.value.actions as Prisma.InputJsonValue,
          precedence: configuration.value.precedence,
          isActive: true,
        },
        select: { id: true },
      });
      await transaction.documentRuleSuggestion.update({
        where: { id },
        data: { status: "APPROVED", approvedRuleId: rule.id, reviewedAt: new Date() },
      });
      await transaction.auditEvent.create({
        data: {
          eventType: "RULE_SUGGESTION_APPROVED",
          entityType: "BusinessRule",
          entityId: rule.id,
          metadata: { suggestionId: id, policyDocumentId: suggestion.policyDocumentId, sourcePageStart: suggestion.sourcePageStart, sourcePageEnd: suggestion.sourcePageEnd },
        },
      });
    });
    revalidatePath("/admin/rules");
    return { success: "Suggestion approved and activated." };
  } catch {
    return { error: "The suggestion could not be reviewed. Please try again." };
  }

}

export async function approveRuleSuggestion(formData: FormData): Promise<void> {
  const data = new FormData();
  formData.forEach((value, key) => data.append(key, value));
  data.set("decision", "APPROVED");
  await reviewRuleSuggestion({}, data);
}

export async function rejectRuleSuggestion(formData: FormData): Promise<void> {
  const data = new FormData();
  formData.forEach((value, key) => data.append(key, value));
  data.set("decision", "REJECTED");
  await reviewRuleSuggestion({}, data);
}
