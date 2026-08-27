-- TASK-082: composite index for Customer Report grouping by customer × currency within company scope.

CREATE INDEX "invoices_company_id_customer_id_currency_code_idx"
  ON "invoices"("company_id", "customer_id", "currency_code");
