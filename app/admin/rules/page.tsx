import { requireAdmin } from "../../../src/lib/admin-auth";
import { prisma } from "../../../src/lib/prisma";
import ConfigurationLayout from "../configuration-layout";
import RuleForm from "./rule-form";
import { saveRule, toggleRule } from "./actions";
import RulesTable from "./rules-table";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  await requireAdmin();
  try {
    const records = await prisma.businessRule.findMany({ orderBy: [{ precedence: "asc" }, { name: "asc" }] });
    const serialized = records.map((record) => ({ ...record, effectiveFrom: record.effectiveFrom?.toISOString() ?? null, effectiveUntil: record.effectiveUntil?.toISOString() ?? null, updatedAt: record.updatedAt.toISOString() }));
    return <ConfigurationLayout><RulesTable records={serialized} saveAction={saveRule} toggleAction={toggleRule} form={<RuleForm record={null} saveAction={saveRule} onDone={() => undefined} />} /></ConfigurationLayout>;
  } catch {
    return <ConfigurationLayout><section className="admin-section"><h1>Business rules</h1><p className="error-message" role="alert">Business rules are temporarily unavailable. Please try again later.</p></section></ConfigurationLayout>;
  }
}
