-- TASK-063: payment_adjustments for dispute open/under review (original SUCCESSFUL payment immutable).
CREATE TYPE "payment_adjustment_type" AS ENUM ('DISPUTE', 'REFUND', 'CHARGEBACK', 'REVERSAL');

CREATE TYPE "payment_adjustment_status" AS ENUM (
  'OPEN',
  'UNDER_REVIEW',
  'PROCESSED',
  'DEBITED',
  'LOST',
  'WON',
  'REVERSED',
  'CANCELLED'
);

CREATE TABLE "payment_adjustments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "type" "payment_adjustment_type" NOT NULL,
    "status" "payment_adjustment_status" NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "invoice_amount" DECIMAL(19,4),
    "settlement_amount" DECIMAL(19,4),
    "reason" TEXT,
    "merchant_reference" TEXT,
    "notes" TEXT,
    "effective_date" DATE NOT NULL,
    "opened_at" TIMESTAMPTZ,
    "processed_at" TIMESTAMPTZ,
    "resolved_at" TIMESTAMPTZ,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "payment_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_adjustments_payment_id_type_status_idx" ON "payment_adjustments"("payment_id", "type", "status");
CREATE INDEX "payment_adjustments_company_id_type_idx" ON "payment_adjustments"("company_id", "type");
CREATE INDEX "payment_adjustments_effective_date_idx" ON "payment_adjustments"("effective_date");

ALTER TABLE "payment_adjustments" ADD CONSTRAINT "payment_adjustments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_adjustments" ADD CONSTRAINT "payment_adjustments_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_adjustments" ADD CONSTRAINT "payment_adjustments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
