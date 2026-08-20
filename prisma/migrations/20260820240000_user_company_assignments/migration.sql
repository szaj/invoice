-- TASK-008 user-to-company assignment.
-- Admin access is all companies regardless of rows here.
-- Reporting groups are not authorization and are not added.

CREATE TABLE "user_companies" (
    "user_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_companies_pkey" PRIMARY KEY ("user_id","company_id")
);

CREATE INDEX "user_companies_company_id_idx" ON "user_companies"("company_id");

ALTER TABLE "user_companies"
    ADD CONSTRAINT "user_companies_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_companies"
    ADD CONSTRAINT "user_companies_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
