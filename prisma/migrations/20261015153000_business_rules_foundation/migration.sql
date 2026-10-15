CREATE TYPE "RuleConditionMode" AS ENUM ('ALL', 'ANY');

ALTER TABLE "BusinessRule"
  ADD COLUMN "conditionMode" "RuleConditionMode" NOT NULL DEFAULT 'ALL',
  ADD COLUMN "actions" JSONB NOT NULL DEFAULT '[]';

CREATE UNIQUE INDEX "BusinessRule_name_key" ON "BusinessRule"("name");
