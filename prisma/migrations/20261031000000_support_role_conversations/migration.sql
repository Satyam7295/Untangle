CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'SUPPORT');

CREATE TABLE "ConversationMessage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticketId" UUID NOT NULL,
    "authorRole" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PolicyEvidence" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "decisionId" UUID NOT NULL,
    "documentName" TEXT NOT NULL,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "excerpt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PolicyEvidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConversationMessage_ticketId_createdAt_idx" ON "ConversationMessage"("ticketId", "createdAt");
CREATE INDEX "PolicyEvidence_decisionId_createdAt_idx" ON "PolicyEvidence"("decisionId", "createdAt");

ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PolicyEvidence" ADD CONSTRAINT "PolicyEvidence_decisionId_fkey"
  FOREIGN KEY ("decisionId") REFERENCES "DecisionRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
