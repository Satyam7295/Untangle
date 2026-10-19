CREATE TABLE "Tenant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE TYPE "PolicyIndexStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

CREATE TABLE "PolicyDocument" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "pageCount" INTEGER,
    "chunkCount" INTEGER,
    "status" "PolicyIndexStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PolicyDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PolicyChunk" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "policyDocumentId" UUID NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" JSONB NOT NULL,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "section" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PolicyChunk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
CREATE UNIQUE INDEX "PolicyDocument_storageKey_key" ON "PolicyDocument"("storageKey");
CREATE UNIQUE INDEX "PolicyChunk_policyDocumentId_chunkIndex_key" ON "PolicyChunk"("policyDocumentId", "chunkIndex");
CREATE INDEX "PolicyDocument_tenantId_status_createdAt_idx" ON "PolicyDocument"("tenantId", "status", "createdAt");
CREATE INDEX "PolicyDocument_tenantId_isActive_idx" ON "PolicyDocument"("tenantId", "isActive");
CREATE INDEX "PolicyDocument_tenantId_sha256_idx" ON "PolicyDocument"("tenantId", "sha256");
CREATE INDEX "PolicyChunk_tenantId_policyDocumentId_idx" ON "PolicyChunk"("tenantId", "policyDocumentId");

ALTER TABLE "PolicyDocument" ADD CONSTRAINT "PolicyDocument_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PolicyChunk" ADD CONSTRAINT "PolicyChunk_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PolicyChunk" ADD CONSTRAINT "PolicyChunk_policyDocumentId_fkey"
  FOREIGN KEY ("policyDocumentId") REFERENCES "PolicyDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
