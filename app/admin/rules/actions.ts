"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "../../../src/lib/admin-auth";
import { prisma } from "../../../src/lib/prisma";
import { normalizeText, validateRuleConfiguration, type RuleConfiguration } from "../../../src/lib/configuration-validation";

export type RuleActionState = { error?: string; success?: string };

function databaseError(error: unknown): RuleActionState {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "A rule with that name already exists." };
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return { error: "The rule no longer exists. Refresh and try again." };
  return { error: "The rule could not be saved. Please try again." };
}

function parsePayload(formData: FormData): RuleConfiguration | { error: string } {
  let conditions: unknown;
  let actions: unknown;
  try {
    conditions = JSON.parse(normalizeText(formData.get("conditions")));
    actions = JSON.parse(normalizeText(formData.get("actions")));
  } catch {
    return { error: "Conditions and actions must be valid structured data." };
  }

  const parsed = validateRuleConfiguration({
    name: normalizeText(formData.get("name")),
    description: normalizeText(formData.get("description")),
    conditionMode: normalizeText(formData.get("conditionMode")),
    conditions,
    actions,
    precedence: Number(normalizeText(formData.get("precedence"))),
    isActive: formData.get("isActive") === "true",
    effectiveFrom: normalizeText(formData.get("effectiveFrom")) || null,
    effectiveUntil: normalizeText(formData.get("effectiveUntil")) || null,
  });
  return parsed.ok ? parsed.value : { error: parsed.error };
}

async function validateReferences(configuration: RuleConfiguration): Promise<string | null> {
  for (const condition of configuration.conditions) {
    const values = Array.isArray(condition.value) ? condition.value : [condition.value];
    if (!["categoryId", "subcategoryId", "priorityId", "assignedTeamId"].includes(condition.field)) continue;
    for (const value of values) {
      if (!value) continue;
      const exists = condition.field === "categoryId"
        ? await prisma.category.findUnique({ where: { id: value }, select: { id: true } })
        : condition.field === "subcategoryId"
          ? await prisma.subcategory.findUnique({ where: { id: value }, select: { id: true } })
          : condition.field === "priorityId"
            ? await prisma.priorityLevel.findUnique({ where: { id: value }, select: { id: true } })
            : await prisma.team.findUnique({ where: { id: value }, select: { id: true } });
      if (!exists) return `The referenced ${condition.field.replace("Id", "")} does not exist.`;
    }
  }
  for (const action of configuration.actions) {
    if (action.type === "ESCALATE" && !/^\d+$/.test(action.value)) return "Escalate actions require a whole-number level.";
    const exists = action.type === "SET_PRIORITY"
      ? await prisma.priorityLevel.findUnique({ where: { id: action.value }, select: { id: true } })
      : action.type === "ASSIGN_TEAM"
        ? await prisma.team.findUnique({ where: { id: action.value }, select: { id: true } })
        : action.type === "SET_CATEGORY"
          ? await prisma.category.findUnique({ where: { id: action.value }, select: { id: true } })
          : true;
    if (!exists) return `The referenced ${action.type.replace("SET_", "").toLowerCase()} does not exist.`;
  }
  return null;
}

export async function saveRule(_previous: RuleActionState, formData: FormData): Promise<RuleActionState> {
  await requireAdmin();
  const payload = parsePayload(formData);
  if ("error" in payload) return payload;
  const configuration = payload;
  const id = normalizeText(formData.get("id"));
  const updatedAt = normalizeText(formData.get("updatedAt"));
  try {
    const referenceError = await validateReferences(configuration);
    if (referenceError) return { error: referenceError };
    const data = {
      name: configuration.name,
      description: configuration.description || null,
      conditionMode: configuration.conditionMode,
      conditions: configuration.conditions as Prisma.InputJsonValue,
      actions: configuration.actions as Prisma.InputJsonValue,
      precedence: configuration.precedence,
      isActive: configuration.isActive,
      effectiveFrom: configuration.effectiveFrom,
      effectiveUntil: configuration.effectiveUntil,
    };
    if (id) {
      if (!updatedAt) return { error: "This rule is missing its update version. Refresh and try again." };
      const result = await prisma.businessRule.updateMany({ where: { id, updatedAt: new Date(updatedAt) }, data });
      if (result.count !== 1) return { error: "This rule changed elsewhere. Refresh before saving your changes." };
    } else {
      await prisma.businessRule.create({ data });
    }
    revalidatePath("/admin");
    revalidatePath("/admin/rules");
    return { success: id ? "Rule updated." : "Rule created." };
  } catch (error) {
    return databaseError(error);
  }
}

export async function toggleRule(id: string, isActive: boolean): Promise<RuleActionState> {
  await requireAdmin();
  if (!id || typeof isActive !== "boolean") return { error: "A valid rule and status are required." };
  try {
    await prisma.businessRule.update({ where: { id }, data: { isActive } });
    revalidatePath("/admin");
    revalidatePath("/admin/rules");
    return { success: isActive ? "Rule activated." : "Rule deactivated." };
  } catch (error) {
    return databaseError(error);
  }
}
