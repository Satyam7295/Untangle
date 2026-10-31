import { requireAdmin } from "../../../src/lib/admin-auth";
import { prisma } from "../../../src/lib/prisma";
import ConfigurationLayout from "../configuration-layout";
import RuleForm from "./rule-form";
import { saveRule, toggleRule } from "./actions";
import RulesTable from "./rules-table";
import { approveRuleSuggestion, rejectRuleSuggestion } from "./suggestion-actions";
import { getAdminConfiguration } from "../../../src/lib/env";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  await requireAdmin();
  try {
    const records = await prisma.businessRule.findMany({ orderBy: [{ precedence: "asc" }, { name: "asc" }] });
    const suggestions = await prisma.documentRuleSuggestion.findMany({
      where: { tenantId: getAdminConfiguration().tenantId },
      include: { policyDocument: { select: { fileName: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
    const serialized = records.map((record) => ({ ...record, effectiveFrom: record.effectiveFrom?.toISOString() ?? null, effectiveUntil: record.effectiveUntil?.toISOString() ?? null, updatedAt: record.updatedAt.toISOString() }));
    return <ConfigurationLayout><RulesTable records={serialized} saveAction={saveRule} toggleAction={toggleRule} form={<RuleForm record={null} saveAction={saveRule} onDone={() => undefined} />} /><section className="admin-section"><h2>Document-derived suggestions</h2><p className="form-note">Suggestions remain inactive until an administrator explicitly approves them.</p>{suggestions.length === 0 ? <p className="form-note">No extracted suggestions.</p> : suggestions.map((suggestion) => <article key={suggestion.id} className="config-card"><strong>{suggestion.status}</strong><p>{suggestion.statement}</p><p className="form-note">{suggestion.policyDocument.fileName} · Page {suggestion.sourcePageStart ?? "?"}{suggestion.sourcePageEnd && suggestion.sourcePageEnd !== suggestion.sourcePageStart ? `-${suggestion.sourcePageEnd}` : ""}</p>{suggestion.status === "PENDING" ? <div className="form-actions"><form action={approveRuleSuggestion}><input type="hidden" name="id" value={suggestion.id} /><button className="primary-button" type="submit">Approve and activate</button></form><form action={rejectRuleSuggestion}><input type="hidden" name="id" value={suggestion.id} /><button className="secondary-button" type="submit">Reject</button></form></div> : null}</article>)}</section></ConfigurationLayout>;
  } catch {
    return <ConfigurationLayout><section className="admin-section"><h1>Business rules</h1><p className="error-message" role="alert">Business rules are temporarily unavailable. Please try again later.</p></section></ConfigurationLayout>;
  }
}
