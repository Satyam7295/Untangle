CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'ESCALATED');
CREATE TYPE "DecisionOutcome" AS ENUM ('ROUTED', 'ESCALATED', 'HUMAN_REVIEW', 'NO_MATCH');

CREATE TABLE "Category" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Subcategory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(), "categoryId" UUID NOT NULL, "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
    "description" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subcategory_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PriorityLevel" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT, "severity" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PriorityLevel_pkey" PRIMARY KEY ("id"), CONSTRAINT "PriorityLevel_severity_check" CHECK ("severity" >= 0)
);
CREATE TABLE "Team" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BusinessRule" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "description" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true,
    "precedence" INTEGER NOT NULL, "conditions" JSONB NOT NULL, "effectiveFrom" TIMESTAMP(3), "effectiveUntil" TIMESTAMP(3), "targetTeamId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessRule_pkey" PRIMARY KEY ("id"), CONSTRAINT "BusinessRule_effective_dates_check" CHECK ("effectiveUntil" IS NULL OR "effectiveFrom" IS NULL OR "effectiveUntil" > "effectiveFrom")
);
CREATE TABLE "ActionConfiguration" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(), "actionType" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT, "configuration" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ActionConfiguration_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BusinessRuleAction" (
    "businessRuleId" UUID NOT NULL, "actionConfigurationId" UUID NOT NULL, "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BusinessRuleAction_pkey" PRIMARY KEY ("businessRuleId", "actionConfigurationId")
);
CREATE TABLE "SlaConfiguration" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "responseMinutes" INTEGER, "resolutionMinutes" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SlaConfiguration_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SlaConfiguration_duration_check" CHECK (("responseMinutes" IS NOT NULL AND "responseMinutes" > 0) OR ("resolutionMinutes" IS NOT NULL AND "resolutionMinutes" > 0))
);
CREATE TABLE "EscalationRule" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT true, "triggerConditions" JSONB NOT NULL,
    "targetTeamId" UUID, "escalationLevel" INTEGER NOT NULL, "slaId" UUID, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EscalationRule_pkey" PRIMARY KEY ("id"), CONSTRAINT "EscalationRule_level_check" CHECK ("escalationLevel" >= 1)
);
CREATE TABLE "Ticket" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(), "referenceNumber" TEXT NOT NULL DEFAULT gen_random_uuid()::text, "originalQuery" TEXT NOT NULL,
    "categoryId" UUID, "subcategoryId" UUID, "priorityId" UUID, "assignedTeamId" UUID, "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "escalationLevel" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id"), CONSTRAINT "Ticket_escalation_level_check" CHECK ("escalationLevel" >= 0)
);
CREATE TABLE "DecisionRecord" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(), "ticketId" UUID NOT NULL, "outcome" "DecisionOutcome" NOT NULL, "explanation" JSONB,
    "humanReviewRequired" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DecisionRecord_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DecisionMatchedRule" (
    "decisionId" UUID NOT NULL, "businessRuleId" UUID NOT NULL, CONSTRAINT "DecisionMatchedRule_pkey" PRIMARY KEY ("decisionId", "businessRuleId")
);
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(), "actorRef" TEXT, "eventType" TEXT NOT NULL, "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL,
    "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE UNIQUE INDEX "Subcategory_categoryId_slug_key" ON "Subcategory"("categoryId", "slug");
CREATE UNIQUE INDEX "PriorityLevel_slug_key" ON "PriorityLevel"("slug");
CREATE UNIQUE INDEX "Team_slug_key" ON "Team"("slug");
CREATE UNIQUE INDEX "ActionConfiguration_actionType_name_key" ON "ActionConfiguration"("actionType", "name");
CREATE UNIQUE INDEX "Ticket_referenceNumber_key" ON "Ticket"("referenceNumber");
CREATE INDEX "Category_isActive_idx" ON "Category"("isActive");
CREATE INDEX "Subcategory_categoryId_isActive_idx" ON "Subcategory"("categoryId", "isActive");
CREATE INDEX "PriorityLevel_isActive_severity_idx" ON "PriorityLevel"("isActive", "severity");
CREATE INDEX "Team_isActive_idx" ON "Team"("isActive");
CREATE INDEX "BusinessRule_isActive_precedence_idx" ON "BusinessRule"("isActive", "precedence");
CREATE INDEX "BusinessRule_targetTeamId_idx" ON "BusinessRule"("targetTeamId");
CREATE INDEX "BusinessRule_effectiveFrom_effectiveUntil_idx" ON "BusinessRule"("effectiveFrom", "effectiveUntil");
CREATE INDEX "ActionConfiguration_actionType_isActive_idx" ON "ActionConfiguration"("actionType", "isActive");
CREATE INDEX "BusinessRuleAction_actionConfigurationId_idx" ON "BusinessRuleAction"("actionConfigurationId");
CREATE INDEX "SlaConfiguration_isActive_idx" ON "SlaConfiguration"("isActive");
CREATE INDEX "EscalationRule_isActive_escalationLevel_idx" ON "EscalationRule"("isActive", "escalationLevel");
CREATE INDEX "EscalationRule_targetTeamId_idx" ON "EscalationRule"("targetTeamId");
CREATE INDEX "EscalationRule_slaId_idx" ON "EscalationRule"("slaId");
CREATE INDEX "Ticket_status_createdAt_idx" ON "Ticket"("status", "createdAt");
CREATE INDEX "Ticket_categoryId_idx" ON "Ticket"("categoryId");
CREATE INDEX "Ticket_subcategoryId_idx" ON "Ticket"("subcategoryId");
CREATE INDEX "Ticket_priorityId_idx" ON "Ticket"("priorityId");
CREATE INDEX "Ticket_assignedTeamId_status_idx" ON "Ticket"("assignedTeamId", "status");
CREATE INDEX "DecisionRecord_ticketId_createdAt_idx" ON "DecisionRecord"("ticketId", "createdAt");
CREATE INDEX "DecisionRecord_outcome_humanReviewRequired_idx" ON "DecisionRecord"("outcome", "humanReviewRequired");
CREATE INDEX "DecisionMatchedRule_businessRuleId_idx" ON "DecisionMatchedRule"("businessRuleId");
CREATE INDEX "AuditEvent_entityType_entityId_createdAt_idx" ON "AuditEvent"("entityType", "entityId", "createdAt");
CREATE INDEX "AuditEvent_eventType_createdAt_idx" ON "AuditEvent"("eventType", "createdAt");
CREATE INDEX "AuditEvent_actorRef_createdAt_idx" ON "AuditEvent"("actorRef", "createdAt");

ALTER TABLE "Subcategory" ADD CONSTRAINT "Subcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessRule" ADD CONSTRAINT "BusinessRule_targetTeamId_fkey" FOREIGN KEY ("targetTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessRuleAction" ADD CONSTRAINT "BusinessRuleAction_businessRuleId_fkey" FOREIGN KEY ("businessRuleId") REFERENCES "BusinessRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessRuleAction" ADD CONSTRAINT "BusinessRuleAction_actionConfigurationId_fkey" FOREIGN KEY ("actionConfigurationId") REFERENCES "ActionConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EscalationRule" ADD CONSTRAINT "EscalationRule_targetTeamId_fkey" FOREIGN KEY ("targetTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EscalationRule" ADD CONSTRAINT "EscalationRule_slaId_fkey" FOREIGN KEY ("slaId") REFERENCES "SlaConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_priorityId_fkey" FOREIGN KEY ("priorityId") REFERENCES "PriorityLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assignedTeamId_fkey" FOREIGN KEY ("assignedTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DecisionRecord" ADD CONSTRAINT "DecisionRecord_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DecisionMatchedRule" ADD CONSTRAINT "DecisionMatchedRule_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "DecisionRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DecisionMatchedRule" ADD CONSTRAINT "DecisionMatchedRule_businessRuleId_fkey" FOREIGN KEY ("businessRuleId") REFERENCES "BusinessRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
