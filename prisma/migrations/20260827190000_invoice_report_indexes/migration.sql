-- TASK-078: composite indexes for Invoice Report filter/sort/pagination.

CREATE INDEX "invoices_company_id_status_invoice_date_idx"
  ON "invoices"("company_id", "status", "invoice_date");

CREATE INDEX "invoices_company_id_currency_code_invoice_date_idx"
  ON "invoices"("company_id", "currency_code", "invoice_date");
