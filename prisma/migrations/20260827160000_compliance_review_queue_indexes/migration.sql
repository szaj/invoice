-- TASK-072: composite indexes for compliance review queue filters.

CREATE INDEX "invoices_company_id_compliance_status_invoice_date_idx"
  ON "invoices"("company_id", "compliance_status", "invoice_date");

CREATE INDEX "payments_company_id_compliance_status_payment_date_idx"
  ON "payments"("company_id", "compliance_status", "payment_date");

CREATE INDEX "payments_company_id_method_code_compliance_status_idx"
  ON "payments"("company_id", "method_code", "compliance_status");
