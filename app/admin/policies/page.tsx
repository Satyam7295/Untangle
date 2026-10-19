import Link from "next/link";

import { requireAdmin } from "../../../src/lib/admin-auth";
import ConfigurationLayout from "../configuration-layout";

export const dynamic = "force-dynamic";

export default async function PolicyManagementPage() {
  await requireAdmin();

  return (
    <ConfigurationLayout>
      <section className="admin-section" aria-labelledby="policy-title">
        <Link className="back-link" href="/admin">← Back to overview</Link>
        <p className="eyebrow">Organization policy</p>
        <h1 id="policy-title">Policy document</h1>
        <p className="lead">
          Upload the document that defines your organization&apos;s decision logic. Untangle will retrieve
          relevant passages during conversations instead of asking you to configure individual rules.
        </p>

        <section className="upload-panel" aria-labelledby="upload-heading">
          <div className="upload-panel-heading">
            <span className="upload-symbol" aria-hidden="true">↑</span>
            <div>
              <h2 id="upload-heading">Upload your policy PDF</h2>
              <p>Use a clear, current document with decision criteria, exceptions and escalation guidance.</p>
            </div>
          </div>
          <label className="upload-dropzone" htmlFor="policy-file">
            <span className="upload-file-icon" aria-hidden="true">PDF</span>
            <strong>Choose a policy document</strong>
            <span>PDF files only · One active policy per organization</span>
            <input id="policy-file" name="policy-file" type="file" accept="application/pdf,.pdf" disabled aria-describedby="upload-status" />
          </label>
          <p id="upload-status" className="form-note">
            File upload is not connected yet. The upload API, secure document storage and RAG indexing will be added before this control is enabled.
          </p>
          <div className="policy-checklist">
            <h3>Before uploading</h3>
            <ul>
              <li>Include the conditions that determine priority and escalation.</li>
              <li>Explain exceptions and what to do when information is missing.</li>
              <li>Specify team or department names if they should receive assigned queries.</li>
              <li>Avoid embedding secrets or unnecessary personal information.</li>
            </ul>
          </div>
        </section>

        <section className="policy-status-panel" aria-labelledby="policy-status-heading">
          <div>
            <p className="eyebrow">Current status</p>
            <h2 id="policy-status-heading">No policy connected</h2>
            <p className="form-note">The active policy status will appear here once upload, extraction and indexing are implemented.</p>
          </div>
          <span className="status-badge">Not configured</span>
        </section>
      </section>
    </ConfigurationLayout>
  );
}
