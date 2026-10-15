import { requireAdmin } from "../../src/lib/admin-auth";
import { prisma } from "../../src/lib/prisma";
import Link from "next/link";
import ConfigurationLayout from "./configuration-layout";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const counts = { categories: 0, subcategories: 0, priorities: 0, rules: 0 };
  let error = "";
  try {
    const [categories, subcategories, priorities, rules] = await Promise.all([
      prisma.category.count(),
      prisma.subcategory.count(),
      prisma.priorityLevel.count(),
      prisma.businessRule.count(),
    ]);
    counts.categories = categories;
    counts.subcategories = subcategories;
    counts.priorities = priorities;
    counts.rules = rules;
  } catch {
    error = "Configuration data is temporarily unavailable.";
  }

  return (
    <ConfigurationLayout>
      <section className="admin-section" aria-labelledby="admin-title">
        <p className="eyebrow">Admin mode</p>
        <h1 id="admin-title">Configuration</h1>
        <p className="lead">Manage the categories, subcategories, and priority levels used by Untangle.</p>
        {error ? <p className="error-message" role="alert">{error}</p> : null}
        <div className="overview-grid">
          <Link className="overview-card" href="/admin/categories"><strong>{counts.categories}</strong><span>Categories</span><small>Organize broad areas of support.</small></Link>
          <Link className="overview-card" href="/admin/subcategories"><strong>{counts.subcategories}</strong><span>Subcategories</span><small>Refine each category with a parent relationship.</small></Link>
          <Link className="overview-card" href="/admin/priorities"><strong>{counts.priorities}</strong><span>Priorities</span><small>Configure priorities without fixed names.</small></Link>
          <Link className="overview-card" href="/admin/rules"><strong>{counts.rules}</strong><span>Business rules</span><small>Manage typed conditions and actions without executing them.</small></Link>
        </div>
      </section>
    </ConfigurationLayout>
  );
}
