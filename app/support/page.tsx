import Link from "next/link";

import { requireAdmin } from "../../src/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function SupportWorkspacePage() {
  // Until role-based tenant membership is implemented, keep this interface
  // behind the existing protected session and do not expose ticket data.
  await requireAdmin();

  return (
    <section className="admin-section support-workspace" aria-labelledby="support-title">
      <nav className="support-topbar" aria-label="Support workspace navigation">
        <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">U</span><span className="brand-name">Untangle</span></Link>
        <span className="status-badge">Support workspace preview</span>
      </nav>
      <p className="eyebrow">Support workspace</p>
      <h1 id="support-title">Assigned queries</h1>
      <p className="lead">
        A read-only workspace for reviewing assigned tickets, the user&apos;s conversation and the
        policy-grounded decision behind each case.
      </p>

      <div className="support-summary-grid" aria-label="Ticket summary">
        <article className="support-summary-card"><span>Assigned to me</span><strong>—</strong><small>Connected after support identity and assignment are implemented</small></article>
        <article className="support-summary-card"><span>Needs attention</span><strong>—</strong><small>Priority and escalation signals from the decision pipeline</small></article>
        <article className="support-summary-card"><span>Recently updated</span><strong>—</strong><small>Latest ticket activity</small></article>
      </div>

      <section className="support-queue-panel" aria-labelledby="queue-title">
        <div className="section-heading">
          <div>
            <h2 id="queue-title">Your queue</h2>
            <p className="form-note">Tickets assigned to your authorized team or support account will appear here.</p>
          </div>
          <span className="status-badge">Read only</span>
        </div>
        <div className="empty-state support-empty-state">
          <span className="support-empty-icon" aria-hidden="true">▤</span>
          <h2>Ticket inbox is not connected yet</h2>
          <p>The existing ticket model has team assignment, but a tenant-aware support identity and assigned-ticket query still need to be implemented. No sample or cross-organization ticket data is shown.</p>
        </div>
      </section>
      <p className="form-note">Preview access currently uses the existing admin session. This is temporary; support-specific role authentication must be added before the workspace is used by support staff.</p>
    </section>
  );
}
