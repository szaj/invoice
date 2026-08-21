-- TASK-030 invoice header schema (Invoices §8.2).
-- BR-001: company_id + customer_id required.
-- Numbering lock, issue, PDF, payments, line items, and totals are later tasks.
-- invoice_number nullable until TASK-035; unique per company when set.

CREATE TYPE "invoice_status" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');

CREATE TYPE "invoice_compliance_status" AS ENUM ('NOT_REVIEWED', 'UNDER_REVIEW', 'APPROVED', 'FLAGGED');

CREATE TABLE "invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "invoice_number" TEXT,
    "invoice_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "reference_po" TEXT,
    "assigned_staff_user_id" UUID,
    "status" "invoice_status" NOT NULL DEFAULT 'DRAFT',
    "compliance_status" "invoice_compliance_status" NOT NULL DEFAULT 'NOT_REVIEWED',
    "internal_notes" TEXT,
    "customer_notes" TEXT,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invoices_company_id_invoice_number_key" ON "invoices"("company_id", "invoice_number");

CREATE INDEX "invoices_company_id_status_idx" ON "invoices"("company_id", "status");

CREATE INDEX "invoices_customer_id_idx" ON "invoices"("customer_id");

CREATE INDEX "invoices_assigned_staff_user_id_idx" ON "invoices"("assigned_staff_user_id");

CREATE INDEX "invoices_invoice_date_idx" ON "invoices"("invoice_date");

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_assigned_staff_user_id_fkey" FOREIGN KEY ("assigned_staff_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
