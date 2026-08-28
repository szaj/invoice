-- TASK-091 operational notification settings flags on system_settings.
-- Defaults enable core alerts; optional payment notifications default off.
-- Admin UI for toggles is TASK-092.

ALTER TABLE "system_settings"
    ADD COLUMN "notify_invoice_email_sent" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "notify_invoice_email_failed" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "notify_payment_success" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "notify_payment_failed" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "notify_invoice_overdue" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "notify_invoice_overdue_to_admin" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "notify_invoice_overdue_to_assigned_staff" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "notify_compliance_flagged" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "notify_gateway_failure" BOOLEAN NOT NULL DEFAULT true;
