import Link from "next/link";

import { requireAdmin } from "../../../src/lib/admin-auth";
import { getAdminConfiguration } from "../../../src/lib/env";
import { prisma } from "../../../src/lib/prisma";
import ConfigurationLayout from "../configuration-layout";
import PolicyUploadForm from "./upload-form";

export const dynamic = "force-dynamic";

export default async function PolicyManagementPage() {
  await requireAdmin();
  const tenantId = getAdminConfiguration().tenantId;
  const policy = await prisma.policyDocument.findFirst({
    where: { tenantId, isActive: true },
    orderBy: { updatedAt: "desc" },
    select: { fileName: true, indexingStatus: true, pageCount: true, chunks: { select: { id: true } } },
  });

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
          <PolicyUploadForm />
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
            <h2 id="policy-status-heading">{policy?.fileName ?? "No policy connected"}</h2>
            <p className="form-note">
              {policy
                ? `${policy.indexingStatus} · ${policy.chunks.length} chunks${policy.pageCount ? ` · ${policy.pageCount} pages` : ""}`
                : "Upload a PDF to extract and index the organization policy."}
            </p>
          </div>
          <span className="status-badge">{policy?.indexingStatus ?? "Not configured"}</span>
        </section>
      </section>
    </ConfigurationLayout>
  );
}
