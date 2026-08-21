-- TASK-034 stored invoice totals (Invoices §8.4 / BR-009).
-- Recalculated from line items and confirmed payment applications.
-- discount_total remains 0 while ADR-010 is OPEN (no discount model invented).
-- confirmed_paid_amount / outstanding_amount are never manually edited as source of truth.

ALTER TABLE "invoices" ADD COLUMN "subtotal" DECIMAL(19,4) NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN "discount_total" DECIMAL(19,4) NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN "tax_total" DECIMAL(19,4) NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN "invoice_total" DECIMAL(19,4) NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN "confirmed_paid_amount" DECIMAL(19,4) NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN "outstanding_amount" DECIMAL(19,4) NOT NULL DEFAULT 0;
