import Link from "next/link";

import { requireAdmin } from "../../src/lib/admin-auth";
import ConfigurationLayout from "./configuration-layout";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();

  return (
    <ConfigurationLayout>
      <section className="admin-section policy-admin" aria-labelledby="admin-title">
        <p className="eyebrow">Admin workspace</p>
        <div className="section-heading">
          <div>
            <h1 id="admin-title">Your policy. Your process.</h1>
            <p className="lead">
              Upload the policy document that explains how your organization handles requests.
              Untangle will use it as the source of truth for its AI-assisted decisions.
            </p>
          </div>
          <Link className="primary-button button-link" href="/admin/policies">Manage policy</Link>
        </div>

        <div className="policy-overview">
          <div className="policy-overview-copy">
            <span className="policy-icon" aria-hidden="true">↥</span>
            <div>
              <h2>Policy document</h2>
              <p>One active policy document per organization. Replace it whenever your process changes.</p>
            </div>
          </div>
          <Link className="secondary-button button-link" href="/admin/policies">Open policy management →</Link>
        </div>

        <div className="policy-process-grid" aria-label="How policy setup works">
          <article className="policy-process-card">
            <span className="step-number">01</span>
            <h2>Upload</h2>
            <p>Provide the policy PDF containing your rules, exceptions and escalation guidance.</p>
          </article>
          <article className="policy-process-card">
            <span className="step-number">02</span>
            <h2>Index</h2>
            <p>Untangle extracts and indexes policy passages so the AI can retrieve relevant evidence.</p>
          </article>
          <article className="policy-process-card">
            <span className="step-number">03</span>
            <h2>Decide with evidence</h2>
            <p>The chatbot asks follow-up questions and grounds recommendations in the active policy.</p>
          </article>
        </div>
        <p className="form-note policy-note">
          Uploads are stored privately, extracted, chunked and embedded before a replacement becomes active.
        </p>
      </section>
    </ConfigurationLayout>
  );
}
