import { requireAdmin } from "../../../src/lib/admin-auth";
import { prisma } from "../../../src/lib/prisma";
import ConfigurationLayout from "../configuration-layout";
import ConfigurationSection, { type PriorityRecord } from "../configuration-section";
import { savePriority, togglePriority } from "../configuration-actions";

export const dynamic = "force-dynamic";

export default async function PrioritiesPage() {
  await requireAdmin();
  try {
    const records = await prisma.priorityLevel.findMany({ orderBy: [{ severity: "asc" }, { name: "asc" }] });
    const serialized: PriorityRecord[] = records.map((record) => ({ ...record, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() }));
    return <ConfigurationLayout><ConfigurationSection title="Priorities" description="Define database-backed priority levels and their severity or display order." records={serialized} saveAction={savePriority} toggleAction={togglePriority} kind="priority" /></ConfigurationLayout>;
  } catch {
    return <ConfigurationLayout><section className="admin-section"><h1>Priorities</h1><p className="error-message" role="alert">Priorities are temporarily unavailable. Please try again later.</p></section></ConfigurationLayout>;
  }
}
