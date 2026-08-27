-- TASK-079: composite indexes for Payment Report filter/sort/pagination.

CREATE INDEX "payments_company_id_method_code_payment_date_idx"
  ON "payments"("company_id", "method_code", "payment_date");

CREATE INDEX "payments_company_id_settlement_currency_code_payment_date_idx"
  ON "payments"("company_id", "settlement_currency_code", "payment_date");
