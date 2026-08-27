-- TASK-080: composite index for Outstanding Report open-balance filter/sort.

CREATE INDEX "invoices_company_id_outstanding_amount_due_date_idx"
  ON "invoices"("company_id", "outstanding_amount", "due_date");
