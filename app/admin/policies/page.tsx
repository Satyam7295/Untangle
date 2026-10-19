import Link from "next/link";

import { requireAdmin } from "../../../src/lib/admin-auth";
import { prisma } from "../../../src/lib/prisma";
import { getAdminTenant } from "../../../src/lib/policy-tenant";
import ConfigurationLayout from "../configuration-layout";
import PolicyUploadForm from "./policy-upload-form";
import PolicyRetryForm from "./policy-retry-form";

export const dynamic = "force-dynamic";

export default async function PolicyManagementPage() {
  await requireAdmin();
  const tenant = await getAdminTenant();
  const policy = await prisma.policyDocument.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      originalFilename: true,
      status: true,
      errorMessage: true,
      isActive: true,
      chunkCount: true,
      pageCount: true,
      createdAt: true,
    },
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
            <h2 id="policy-status-heading">
              {policy?.isActive ? "Policy active" : policy ? `Indexing ${policy.status.toLowerCase()}` : "No policy connected"}
            </h2>
            <p className="form-note">
              {policy?.isActive
                ? `${policy.originalFilename} · ${policy.pageCount ?? 0} pages · ${policy.chunkCount ?? 0} chunks`
                : policy?.errorMessage || "Upload a PDF to extract and index its policy text."}
            </p>
          </div>
          <span className="status-badge">{policy?.isActive ? "Ready" : policy?.status || "Not configured"}</span>
        </section>
        {policy?.status === "FAILED" && (
          <PolicyRetryForm documentId={policy.id} />
        )}
      </section>
    </ConfigurationLayout>
  );
}
