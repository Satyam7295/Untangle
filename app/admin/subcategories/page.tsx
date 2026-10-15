import { requireAdmin } from "../../../src/lib/admin-auth";
import { prisma } from "../../../src/lib/prisma";
import ConfigurationLayout from "../configuration-layout";
import ConfigurationSection, { type CategoryRecord, type SubcategoryRecord } from "../configuration-section";
import { saveSubcategory, toggleSubcategory } from "../configuration-actions";

export const dynamic = "force-dynamic";

export default async function SubcategoriesPage() {
  await requireAdmin();
  try {
    const [records, categories] = await Promise.all([
      prisma.subcategory.findMany({ include: { category: true }, orderBy: [{ category: { name: "asc" } }, { name: "asc" }] }),
      prisma.category.findMany({ orderBy: { name: "asc" } }),
    ]);
    const serialized: SubcategoryRecord[] = records.map(({ category, ...record }) => ({
      ...record,
      categoryName: category.name,
      categoryIsActive: category.isActive,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    }));
    const categoryOptions: CategoryRecord[] = categories.map((category) => ({ ...category, createdAt: category.createdAt.toISOString(), updatedAt: category.updatedAt.toISOString() }));
    return <ConfigurationLayout><ConfigurationSection title="Subcategories" description="Connect more specific topics to a valid parent category." records={serialized} categories={categoryOptions} saveAction={saveSubcategory} toggleAction={toggleSubcategory} kind="subcategory" /></ConfigurationLayout>;
  } catch {
    return <ConfigurationLayout><section className="admin-section"><h1>Subcategories</h1><p className="error-message" role="alert">Subcategories are temporarily unavailable. Please try again later.</p></section></ConfigurationLayout>;
  }
}
