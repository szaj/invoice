-- TASK-011 reporting groups.
-- Optional parent groups for consolidated report roll-ups.
-- Membership does not grant company access; user_companies remains authoritative.
-- No seed data (VX is an example only). No reporting engines or financial aggregation.

CREATE TYPE "reporting_group_status" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "company_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "reporting_group_status" NOT NULL DEFAULT 'ACTIVE',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_groups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_groups_code_key" ON "company_groups"("code");

ALTER TABLE "companies"
ADD COLUMN "reporting_group_id" UUID;

ALTER TABLE "companies"
ADD CONSTRAINT "companies_reporting_group_id_fkey"
FOREIGN KEY ("reporting_group_id") REFERENCES "company_groups"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "companies_reporting_group_id_idx" ON "companies"("reporting_group_id");
