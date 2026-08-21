-- TASK-038: invoice cancellation reason (soft status; no hard delete). BR-012 / BR-019.

ALTER TABLE "invoices" ADD COLUMN "cancellation_reason" TEXT;
ALTER TABLE "invoices" ADD COLUMN "cancelled_at" TIMESTAMPTZ;
ALTER TABLE "invoices" ADD COLUMN "cancelled_by_user_id" UUID;

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
