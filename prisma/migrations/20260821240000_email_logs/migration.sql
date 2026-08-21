-- TASK-041: email delivery logs (ADR-007). PDF binaries remain in object storage.

CREATE TYPE "email_delivery_status" AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE "email_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "invoice_file_id" UUID,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "email_delivery_status" NOT NULL,
    "provider_message_id" TEXT,
    "error_message" TEXT,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "sent_by_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "email_logs_invoice_id_idx" ON "email_logs"("invoice_id");
CREATE INDEX "email_logs_company_id_created_at_idx" ON "email_logs"("company_id", "created_at");

ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_invoice_file_id_fkey" FOREIGN KEY ("invoice_file_id") REFERENCES "invoice_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_sent_by_user_id_fkey" FOREIGN KEY ("sent_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
