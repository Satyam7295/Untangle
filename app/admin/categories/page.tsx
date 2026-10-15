import { requireAdmin } from "../../../src/lib/admin-auth";
import { prisma } from "../../../src/lib/prisma";
import ConfigurationLayout from "../configuration-layout";
import ConfigurationSection, { type CategoryRecord } from "../configuration-section";
import { saveCategory, toggleCategory } from "../configuration-actions";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  await requireAdmin();
  try {
    const records = await prisma.category.findMany({ orderBy: { name: "asc" } });
    const serialized: CategoryRecord[] = records.map((record) => ({ ...record, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() }));
    return <ConfigurationLayout><ConfigurationSection title="Categories" description="Create and maintain the broad areas used to classify queries." records={serialized} saveAction={saveCategory} toggleAction={toggleCategory} kind="category" /></ConfigurationLayout>;
  } catch {
    return <ConfigurationLayout><section className="admin-section"><h1>Categories</h1><p className="error-message" role="alert">Categories are temporarily unavailable. Please try again later.</p></section></ConfigurationLayout>;
  }
}
