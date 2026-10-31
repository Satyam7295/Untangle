CREATE TYPE "DocumentRuleSuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "DocumentRuleSuggestion" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" TEXT NOT NULL,
  "policyDocumentId" UUID NOT NULL,
  "sourceChunkId" UUID NOT NULL,
  "sourcePageStart" INTEGER,
  "sourcePageEnd" INTEGER,
  "statement" TEXT NOT NULL,
  "proposedConditions" JSONB NOT NULL,
  "proposedActions" JSONB NOT NULL,
  "status" "DocumentRuleSuggestionStatus" NOT NULL DEFAULT 'PENDING',
  "rejectionReason" TEXT,
  "approvedRuleId" UUID,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentRuleSuggestion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DocumentRuleSuggestion_policyDocumentId_fkey"
    FOREIGN KEY ("policyDocumentId") REFERENCES "PolicyDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "DocumentRuleSuggestion_tenantId_status_createdAt_idx"
  ON "DocumentRuleSuggestion"("tenantId", "status", "createdAt");
CREATE INDEX "DocumentRuleSuggestion_policyDocumentId_sourcePageStart_idx"
  ON "DocumentRuleSuggestion"("policyDocumentId", "sourcePageStart");

ALTER TABLE "Ticket"
  ADD COLUMN "triggeringBusinessRuleId" UUID,
  ADD COLUMN "matchedConditions" JSONB,
  ADD COLUMN "escalationReason" TEXT;
CREATE INDEX "Ticket_triggeringBusinessRuleId_idx" ON "Ticket"("triggeringBusinessRuleId");
