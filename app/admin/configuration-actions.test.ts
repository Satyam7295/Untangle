import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  category: {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
  },
  subcategory: { create: vi.fn(), update: vi.fn() },
  priorityLevel: { create: vi.fn(), update: vi.fn() },
}));

vi.mock("../../src/lib/admin-auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("../../src/lib/prisma", () => ({ prisma: mocks }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  saveCategory,
  savePriority,
  saveSubcategory,
  toggleCategory,
} from "./configuration-actions";

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

describe("admin configuration mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(undefined);
    mocks.category.create.mockResolvedValue({});
    mocks.category.update.mockResolvedValue({});
    mocks.category.findUnique.mockResolvedValue({ id: "category-1", isActive: true });
    mocks.subcategory.create.mockResolvedValue({});
    mocks.priorityLevel.create.mockResolvedValue({});
  });

  it("rejects unauthorized mutations before touching Prisma", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("redirect"));
    await expect(saveCategory({}, form({ name: "Support" }))).rejects.toThrow("redirect");
    expect(mocks.category.create).not.toHaveBeenCalled();
  });

  it("creates a category with a generated slug", async () => {
    const result = await saveCategory({}, form({ name: "Customer Support", description: "" }));
    expect(result).toEqual({ success: "Category created." });
    expect(mocks.category.create).toHaveBeenCalledWith({
      data: { name: "Customer Support", slug: "customer-support", description: null },
    });
  });

  it("requires an existing parent when creating a subcategory", async () => {
    mocks.category.findUnique.mockResolvedValue(null);
    const result = await saveSubcategory({}, form({
      name: "Billing", categoryId: "missing-category", description: "",
    }));
    expect(result.error).toBe("The selected parent category does not exist.");
    expect(mocks.subcategory.create).not.toHaveBeenCalled();
  });

  it("rejects invalid priority severity values", async () => {
    const result = await savePriority({}, form({
      name: "Urgent", severity: "2.5", description: "",
    }));
    expect(result.error).toBe("Severity must be a whole number.");
    expect(mocks.priorityLevel.create).not.toHaveBeenCalled();
  });

  it("authenticates activation changes", async () => {
    const result = await toggleCategory("category-1", false);
    expect(result).toEqual({ success: "Record deactivated." });
    expect(mocks.category.update).toHaveBeenCalledWith({
      where: { id: "category-1" },
      data: { isActive: false },
    });
  });
});
