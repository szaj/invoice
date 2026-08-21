-- TASK-025 customer_companies multi-company linkage.
-- Access for Staff/Compliance is via linked companies (replaces interim defaultCompanyId/assignee scope).
-- Backfill existing customers that already have a default_company_id preference.

CREATE TABLE "customer_companies" (
    "customer_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_companies_pkey" PRIMARY KEY ("customer_id", "company_id")
);

CREATE INDEX "customer_companies_company_id_idx" ON "customer_companies"("company_id");

ALTER TABLE "customer_companies"
  ADD CONSTRAINT "customer_companies_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_companies"
  ADD CONSTRAINT "customer_companies_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "customer_companies" ("customer_id", "company_id")
SELECT "id", "default_company_id"
FROM "customers"
WHERE "default_company_id" IS NOT NULL
ON CONFLICT DO NOTHING;
