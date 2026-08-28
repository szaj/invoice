-- TASK-098: list/report filter indexes (invoice number, staff visibility, dates, transaction IDs).

CREATE INDEX "customers_country_code_idx" ON "customers"("country_code");
CREATE INDEX "customers_status_display_name_idx" ON "customers"("status", "display_name");

CREATE INDEX "invoices_invoice_number_idx" ON "invoices"("invoice_number");
CREATE INDEX "invoices_created_by_user_id_idx" ON "invoices"("created_by_user_id");
CREATE INDEX "invoices_due_date_idx" ON "invoices"("due_date");
CREATE INDEX "invoices_company_id_created_by_user_id_idx" ON "invoices"("company_id", "created_by_user_id");
CREATE INDEX "invoices_company_id_assigned_staff_user_id_idx" ON "invoices"("company_id", "assigned_staff_user_id");

CREATE INDEX "payments_external_transaction_id_idx" ON "payments"("external_transaction_id");
CREATE INDEX "payments_company_id_customer_id_payment_date_idx" ON "payments"("company_id", "customer_id", "payment_date");
CREATE INDEX "payments_company_id_invoice_currency_code_payment_date_idx"
  ON "payments"("company_id", "invoice_currency_code", "payment_date");

CREATE INDEX "payment_events_external_transaction_id_idx" ON "payment_events"("external_transaction_id");

CREATE INDEX "payment_adjustments_company_id_type_status_effective_date_idx"
  ON "payment_adjustments"("company_id", "type", "status", "effective_date");
CREATE INDEX "payment_adjustments_company_id_effective_date_idx"
  ON "payment_adjustments"("company_id", "effective_date");
