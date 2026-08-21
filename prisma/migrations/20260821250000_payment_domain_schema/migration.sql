-- TASK-044 payment domain schema (Payments §10.3 / ADR-008).
-- Provider-agnostic payment records. No credentials, charges, webhooks, allocation, or UI.
-- Money: NUMERIC(19,4); rates: NUMERIC(20,12). Fee and actual received are optional reconciliation only (BR-020).

CREATE TYPE "payment_status" AS ENUM ('PENDING', 'SUCCESSFUL', 'FAILED');

CREATE TYPE "payment_source" AS ENUM ('MANUAL', 'GATEWAY_API', 'GATEWAY_WEBHOOK', 'SYSTEM');

CREATE TYPE "payment_rate_source" AS ENUM ('ADMIN_FIXED_RATE', 'SAME_CURRENCY');

CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "method_code" "payment_method_code" NOT NULL,
    "external_transaction_id" TEXT,
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "invoice_currency_code" CHAR(3) NOT NULL,
    "invoice_amount_applied" DECIMAL(19,4) NOT NULL,
    "settlement_currency_code" CHAR(3) NOT NULL,
    "fixed_conversion_rate" DECIMAL(20,12) NOT NULL,
    "rate_version_id" UUID,
    "rate_source" "payment_rate_source" NOT NULL,
    "converted_settlement_amount" DECIMAL(19,4) NOT NULL,
    "processor_fee_amount" DECIMAL(19,4),
    "actual_received_amount" DECIMAL(19,4),
    "payment_date" DATE NOT NULL,
    "received_at" TIMESTAMPTZ,
    "source" "payment_source" NOT NULL,
    "notes" TEXT,
    "created_by_user_id" UUID,
    "confirmed_by_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payments_company_id_status_idx" ON "payments"("company_id", "status");

CREATE INDEX "payments_invoice_id_idx" ON "payments"("invoice_id");

CREATE INDEX "payments_customer_id_idx" ON "payments"("customer_id");

CREATE INDEX "payments_method_code_external_transaction_id_idx" ON "payments"("method_code", "external_transaction_id");

CREATE INDEX "payments_payment_date_idx" ON "payments"("payment_date");

ALTER TABLE "payments" ADD CONSTRAINT "payments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments" ADD CONSTRAINT "payments_rate_version_id_fkey" FOREIGN KEY ("rate_version_id") REFERENCES "fixed_conversion_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payments" ADD CONSTRAINT "payments_confirmed_by_user_id_fkey" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
