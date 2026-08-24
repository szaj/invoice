-- TASK-053: payment_events idempotency store for gateway webhooks.
CREATE TYPE "payment_event_processing_status" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

CREATE TABLE "payment_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "method_code" "payment_method_code" NOT NULL,
    "payment_id" UUID,
    "external_event_id" TEXT NOT NULL,
    "external_transaction_id" TEXT,
    "normalized_status" "payment_status",
    "processor_fee_amount" DECIMAL(19,4),
    "processing_status" "payment_event_processing_status" NOT NULL DEFAULT 'RECEIVED',
    "correlation_id" TEXT NOT NULL,
    "error_message" TEXT,
    "processed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_events_method_code_external_event_id_key" ON "payment_events"("method_code", "external_event_id");
CREATE INDEX "payment_events_company_id_method_code_idx" ON "payment_events"("company_id", "method_code");
CREATE INDEX "payment_events_payment_id_idx" ON "payment_events"("payment_id");
CREATE INDEX "payment_events_correlation_id_idx" ON "payment_events"("correlation_id");
CREATE INDEX "payment_events_created_at_idx" ON "payment_events"("created_at");

ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
