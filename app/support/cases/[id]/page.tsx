import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSupport } from "../../../../src/lib/admin-auth";
import { getSupportCase } from "../../../../src/lib/support-cases";
import CaseActions from "./case-actions";

export const dynamic = "force-dynamic";

export default async function SupportCasePage({ params }: { params: Promise<{ id: string }> }) {
  await requireSupport();
  const supportCase = await getSupportCase((await params).id);
  if (!supportCase) notFound();
  const decision = supportCase.decisions[0];

  return (
    <section className="admin-section support-workspace" aria-labelledby="case-title">
      <nav className="support-topbar" aria-label="Support case navigation">
        <Link className="brand" href="/support"><span className="brand-mark" aria-hidden="true">U</span><span className="brand-name">Support queue</span></Link>
      </nav>
      <Link className="back-link" href="/support">← Back to queue</Link>
      <div className="section-heading support-case-heading">
        <div><p className="eyebrow">Case {supportCase.referenceNumber}</p><h1 id="case-title">{supportCase.originalQuery}</h1></div>
        <span className={`case-status case-status-${supportCase.status.toLowerCase()}`}>{supportCase.status.replace("_", " ")}</span>
      </div>
      <div className="support-case-meta"><span>Created {supportCase.createdAt.toLocaleString()}</span><span>Updated {supportCase.updatedAt.toLocaleString()}</span><span>Priority {supportCase.priority?.name ?? "Normal"}</span><span>Team {supportCase.assignedTeam?.name ?? "Unassigned"}</span></div>
      {supportCase.escalationReason ? <p className="form-note">Escalation reason: {supportCase.escalationReason}</p> : null}
      <section className="support-detail-grid">
        <div className="support-history" aria-label="Complete conversation history">
          <h2>Conversation</h2>
          {supportCase.messages.length === 0 ? <p className="form-note">No messages have been recorded for this case yet.</p> : supportCase.messages.map((message) => (
            <article className="support-message" key={message.id}><div><strong>{message.authorRole}</strong><time dateTime={message.createdAt.toISOString()}>{message.createdAt.toLocaleString()}</time></div><p>{message.content}</p></article>
          ))}
          <CaseActions caseId={supportCase.id} resolved={supportCase.status === "RESOLVED"} />
        </div>
        <aside className="support-evidence"><h2>Policy evidence</h2>
          {decision?.evidence.length ? decision.evidence.map((evidence) => <article className="evidence-card" key={evidence.id}><strong>{evidence.documentName}</strong><span>{evidence.sourceId ? `Source ${evidence.sourceId} · ` : ""}Page {evidence.pageStart ?? "?"}{evidence.pageEnd && evidence.pageEnd !== evidence.pageStart ? `-${evidence.pageEnd}` : ""}</span><p>{evidence.excerpt}</p></article>) : <p className="form-note">No retrieved evidence was recorded for this case.</p>}
        </aside>
      </section>
    </section>
  );
}
