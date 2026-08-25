-- TASK-071: shared compliance status on customers/payments; compliance_reviews skeleton.
-- Invoices already had compliance_status via invoice_compliance_status enum.

ALTER TYPE "invoice_compliance_status" RENAME TO "compliance_status";

ALTER TABLE "customers" ADD COLUMN "compliance_status" "compliance_status" NOT NULL DEFAULT 'NOT_REVIEWED';

ALTER TABLE "payments" ADD COLUMN "compliance_status" "compliance_status" NOT NULL DEFAULT 'NOT_REVIEWED';

CREATE INDEX "customers_compliance_status_idx" ON "customers"("compliance_status");

CREATE INDEX "payments_company_id_compliance_status_idx" ON "payments"("company_id", "compliance_status");

CREATE INDEX "invoices_company_id_compliance_status_idx" ON "invoices"("company_id", "compliance_status");

CREATE TYPE "compliance_review_subject_type" AS ENUM ('INVOICE', 'PAYMENT', 'CUSTOMER');

CREATE TABLE "compliance_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "subject_type" "compliance_review_subject_type" NOT NULL,
    "subject_id" UUID NOT NULL,
    "status" "compliance_status" NOT NULL,
    "reviewer_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "compliance_reviews_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "compliance_reviews" ADD CONSTRAINT "compliance_reviews_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "compliance_reviews" ADD CONSTRAINT "compliance_reviews_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "compliance_reviews_company_id_status_idx" ON "compliance_reviews"("company_id", "status");

CREATE INDEX "compliance_reviews_subject_type_subject_id_idx" ON "compliance_reviews"("subject_type", "subject_id");

CREATE INDEX "compliance_reviews_created_at_idx" ON "compliance_reviews"("created_at");
