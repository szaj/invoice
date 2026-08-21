-- TASK-035 invoice numbering: per-company sequence; optional year flag on system settings.
-- Unique (company_id, invoice_number) already exists from TASK-030.
-- Numbers are never reused (sequence only increments). Allocation is transactional.

ALTER TABLE "companies" ADD COLUMN "invoice_sequence_next" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "system_settings" ADD COLUMN "invoice_number_include_year" BOOLEAN NOT NULL DEFAULT false;
