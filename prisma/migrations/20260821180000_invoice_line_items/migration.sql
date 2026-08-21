-- TASK-033 invoice line items (Invoices §8.3).
-- Discount omitted until ADR-010 is accepted.
-- Tax name/rate optional snapshots; invoice totals aggregation is TASK-034.
-- line_total is server-calculated: round(quantity × unit_rate).

CREATE TABLE "invoice_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "invoice_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(20,6) NOT NULL,
    "unit_rate" DECIMAL(19,4) NOT NULL,
    "tax_name" TEXT,
    "tax_rate_percent" DECIMAL(10,6),
    "line_total" DECIMAL(19,4) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "invoice_items_invoice_id_sort_order_idx" ON "invoice_items"("invoice_id", "sort_order");

ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
