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
    select: { id: true, fileName: true, indexingStatus: true, pageCount: true, updatedAt: true, chunks: { select: { id: true } } },
  });

  return (
    <ConfigurationLayout>
      <section className="admin-section policy-page" aria-labelledby="policy-title">
        <div className="policy-introduction">
          <Link className="back-link" href="/admin">← Back to overview</Link>
          <p className="eyebrow">Organization policy</p>
          <h1 id="policy-title">Policy document</h1>
          <p className="lead">
            Upload the policy that defines your organization&apos;s decision criteria. Untangle uses its
            contents to provide policy-grounded responses.
          </p>
        </div>

        <section className="upload-panel" aria-labelledby="upload-heading">
          <div className="upload-panel-heading">
            <div>
              <p className="section-kicker">Policy source</p>
              <h2 id="upload-heading">Upload policy document</h2>
              <p>Upload a PDF containing decision criteria, exceptions, and escalation guidance.</p>
            </div>
          </div>
          <PolicyUploadForm
            initialPolicy={policy ? {
              id: policy.id,
              fileName: policy.fileName,
              indexingStatus: policy.indexingStatus,
              pageCount: policy.pageCount,
              chunkCount: policy.chunks.length,
              updatedAt: policy.updatedAt.toISOString(),
            } : null}
          />
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

      </section>
    </ConfigurationLayout>
  );
}
