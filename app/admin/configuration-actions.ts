"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "../../src/lib/admin-auth";
import { prisma } from "../../src/lib/prisma";
import {
  normalizeText,
  parseSeverity,
  validateDescription,
  validateName,
  validateSlug,
} from "../../src/lib/configuration-validation";

export type ActionState = { error?: string; success?: string };

function databaseError(error: unknown): ActionState {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return { error: "That value is already in use. Choose a unique name or slug." };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return { error: "The record no longer exists. Refresh the page and try again." };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
    return { error: "The selected parent category is no longer available." };
  }
  return { error: "The configuration could not be saved. Please try again." };
}

function idFrom(formData: FormData): string | null {
  const id = normalizeText(formData.get("id"));
  return id || null;
}

export async function saveCategory(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const id = idFrom(formData);
  const name = normalizeText(formData.get("name"));
  const description = normalizeText(formData.get("description"));
  const nameResult = validateName(name);
  const descriptionResult = validateDescription(description);
  const slugResult = validateSlug(normalizeText(formData.get("slug")), name);
  if (!nameResult.ok) return { error: nameResult.error };
  if (!descriptionResult.ok) return { error: descriptionResult.error };
  if (!slugResult.ok) return { error: slugResult.error };

  try {
    if (id) {
      await prisma.category.update({
        where: { id },
        data: { name, slug: slugResult.value, description: description || null },
      });
    } else {
      await prisma.category.create({
        data: { name, slug: slugResult.value, description: description || null },
      });
    }
    revalidatePath("/admin");
    revalidatePath("/admin/categories");
    revalidatePath("/admin/subcategories");
    return { success: id ? "Category updated." : "Category created." };
  } catch (error) {
    return databaseError(error);
  }
}

export async function saveSubcategory(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const id = idFrom(formData);
  const categoryId = normalizeText(formData.get("categoryId"));
  const name = normalizeText(formData.get("name"));
  const description = normalizeText(formData.get("description"));
  const nameResult = validateName(name);
  const descriptionResult = validateDescription(description);
  const slugResult = validateSlug(normalizeText(formData.get("slug")), name);
  if (!categoryId) return { error: "Select a parent category." };
  if (!nameResult.ok) return { error: nameResult.error };
  if (!descriptionResult.ok) return { error: descriptionResult.error };
  if (!slugResult.ok) return { error: slugResult.error };

  try {
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) return { error: "The selected parent category does not exist." };
    if (id) {
      await prisma.subcategory.update({
        where: { id },
        data: { categoryId, name, slug: slugResult.value, description: description || null },
      });
    } else {
      await prisma.subcategory.create({
        data: { categoryId, name, slug: slugResult.value, description: description || null },
      });
    }
    revalidatePath("/admin/subcategories");
    revalidatePath("/admin/categories");
    return { success: id ? "Subcategory updated." : "Subcategory created." };
  } catch (error) {
    return databaseError(error);
  }
}

export async function savePriority(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const id = idFrom(formData);
  const name = normalizeText(formData.get("name"));
  const description = normalizeText(formData.get("description"));
  const nameResult = validateName(name);
  const descriptionResult = validateDescription(description);
  const slugResult = validateSlug(normalizeText(formData.get("slug")), name);
  const severityResult = parseSeverity(normalizeText(formData.get("severity")));
  if (!nameResult.ok) return { error: nameResult.error };
  if (!descriptionResult.ok) return { error: descriptionResult.error };
  if (!slugResult.ok) return { error: slugResult.error };
  if (!severityResult.ok) return { error: severityResult.error };

  try {
    if (id) {
      await prisma.priorityLevel.update({
        where: { id },
        data: {
          name,
          slug: slugResult.value,
          description: description || null,
          severity: severityResult.value,
        },
      });
    } else {
      await prisma.priorityLevel.create({
        data: {
          name,
          slug: slugResult.value,
          description: description || null,
          severity: severityResult.value,
        },
      });
    }
    revalidatePath("/admin");
    revalidatePath("/admin/priorities");
    return { success: id ? "Priority updated." : "Priority created." };
  } catch (error) {
    return databaseError(error);
  }
}

async function setActive(
  entity: "category" | "subcategory" | "priorityLevel",
  id: string,
  isActive: boolean,
): Promise<ActionState> {
  await requireAdmin();
  if (!id) return { error: "A record must be selected." };
  if (typeof isActive !== "boolean") return { error: "Invalid status." };
  try {
    if (entity === "category") await prisma.category.update({ where: { id }, data: { isActive } });
    if (entity === "subcategory") await prisma.subcategory.update({ where: { id }, data: { isActive } });
    if (entity === "priorityLevel") await prisma.priorityLevel.update({ where: { id }, data: { isActive } });
    revalidatePath("/admin");
    revalidatePath("/admin/categories");
    revalidatePath("/admin/subcategories");
    revalidatePath("/admin/priorities");
    return { success: isActive ? "Record activated." : "Record deactivated." };
  } catch (error) {
    return databaseError(error);
  }
}

export async function toggleCategory(id: string, isActive: boolean): Promise<ActionState> {
  return setActive("category", id, isActive);
}

export async function toggleSubcategory(id: string, isActive: boolean): Promise<ActionState> {
  return setActive("subcategory", id, isActive);
}

export async function togglePriority(id: string, isActive: boolean): Promise<ActionState> {
  return setActive("priorityLevel", id, isActive);
}
