-- TASK-077: composite indexes for dashboard KPI date/status aggregates.

CREATE INDEX "invoices_company_id_status_due_date_idx"
  ON "invoices"("company_id", "status", "due_date");

CREATE INDEX "invoices_company_id_invoice_date_idx"
  ON "invoices"("company_id", "invoice_date");

CREATE INDEX "payments_company_id_status_payment_date_idx"
  ON "payments"("company_id", "status", "payment_date");
