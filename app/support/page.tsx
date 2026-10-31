import Link from "next/link";

import { requireSupport } from "../../src/lib/admin-auth";
import { listSupportCases } from "../../src/lib/support-cases";
import { logoutSupport } from "./actions";

export const dynamic = "force-dynamic";

export default async function SupportWorkspacePage() {
  await requireSupport();
  const cases = await listSupportCases();
  const counts = {
    total: cases.length,
    pending: cases.filter((supportCase) => supportCase.status === "ESCALATED").length,
    inProgress: cases.filter((supportCase) => supportCase.status === "IN_PROGRESS").length,
    resolved: cases.filter((supportCase) => supportCase.status === "RESOLVED").length,
  };

  return (
    <section className="admin-section support-workspace" aria-labelledby="support-title">
      <nav className="support-topbar" aria-label="Support workspace navigation">
        <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">U</span><span className="brand-name">Untangle</span></Link>
        <form action={logoutSupport}><button className="text-button" type="submit">Sign out</button></form>
      </nav>
      <p className="eyebrow">Support workspace</p>
      <div className="section-heading">
        <div>
          <h1 id="support-title">Escalated cases</h1>
          <p className="lead">Review policy-grounded conversations and help users resolve their questions.</p>
        </div>
      </div>
      <div className="support-summary-grid" aria-label="Case summary">
        <Summary label="Total escalated" value={counts.total} />
        <Summary label="Pending" value={counts.pending} />
        <Summary label="In progress" value={counts.inProgress} />
        <Summary label="Resolved" value={counts.resolved} />
      </div>
      <section className="support-queue-panel" aria-labelledby="queue-title">
        <div className="section-heading">
          <div><h2 id="queue-title">Case queue</h2><p className="form-note">Cases requiring human review and support follow-up.</p></div>
        </div>
        {cases.length === 0 ? (
          <div className="empty-state support-empty-state"><h2>No escalated cases</h2><p>New escalations will appear here when the policy system requires human review.</p></div>
        ) : (
          <div className="support-case-list">
            {cases.map((supportCase) => (
              <Link className="support-case-row" href={`/support/cases/${supportCase.id}`} key={supportCase.id}>
                <div><strong>{supportCase.referenceNumber}</strong><p>{supportCase.originalQuery}</p></div>
                <span className={`case-status case-status-${supportCase.status.toLowerCase()}`}>{supportCase.status.replace("_", " ")}</span>
                <span>{supportCase.priority?.name ?? "Normal"}</span>
                <time dateTime={supportCase.createdAt.toISOString()}>{supportCase.createdAt.toLocaleDateString()}</time>
              </Link>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <article className="support-summary-card"><span>{label}</span><strong>{value}</strong><small>Current support queue</small></article>;
}
