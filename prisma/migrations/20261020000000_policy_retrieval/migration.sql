CREATE TYPE "PolicyIndexingStatus" AS ENUM ('UPLOADING', 'EXTRACTING', 'CHUNKING', 'EMBEDDING', 'READY', 'FAILED');

CREATE TABLE "PolicyDocument" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "title" TEXT,
    "indexingStatus" "PolicyIndexingStatus" NOT NULL DEFAULT 'UPLOADING',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PolicyChunk" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "policyId" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "sectionHeading" TEXT,
    "embedding" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyChunk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PolicyDocument_tenantId_isActive_key" ON "PolicyDocument"("tenantId", "isActive") WHERE "isActive" = true;
CREATE INDEX "PolicyDocument_tenantId_isActive_indexingStatus_idx" ON "PolicyDocument"("tenantId", "isActive", "indexingStatus");
CREATE UNIQUE INDEX "PolicyChunk_policyId_chunkIndex_key" ON "PolicyChunk"("policyId", "chunkIndex");
CREATE INDEX "PolicyChunk_tenantId_policyId_idx" ON "PolicyChunk"("tenantId", "policyId");

ALTER TABLE "PolicyChunk" ADD CONSTRAINT "PolicyChunk_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "PolicyDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
