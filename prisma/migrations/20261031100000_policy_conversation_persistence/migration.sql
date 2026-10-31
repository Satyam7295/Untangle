ALTER TABLE "Ticket" ADD COLUMN "conversationId" UUID;
ALTER TABLE "Ticket" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default';
UPDATE "Ticket" SET "conversationId" = gen_random_uuid() WHERE "conversationId" IS NULL;
ALTER TABLE "Ticket" ALTER COLUMN "conversationId" SET NOT NULL;
ALTER TABLE "Ticket" ALTER COLUMN "conversationId" SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "Ticket_conversationId_key" ON "Ticket"("conversationId");
CREATE INDEX "Ticket_tenantId_status_updatedAt_idx" ON "Ticket"("tenantId", "status", "updatedAt");

ALTER TABLE "PolicyEvidence" ADD COLUMN "sourceId" TEXT;
ALTER TABLE "PolicyEvidence" ADD COLUMN "relevanceScore" DOUBLE PRECISION;
