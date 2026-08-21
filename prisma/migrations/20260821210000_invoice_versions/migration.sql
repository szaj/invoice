-- TASK-037: immutable invoice version snapshots created on issue (not financial revision workflow).
-- ADR-009 remains OPEN — versions do not authorize issued financial edits.

CREATE TABLE "invoice_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "invoice_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "reason" TEXT,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invoice_versions_invoice_id_version_no_key" ON "invoice_versions"("invoice_id", "version_no");

CREATE INDEX "invoice_versions_invoice_id_idx" ON "invoice_versions"("invoice_id");

ALTER TABLE "invoice_versions" ADD CONSTRAINT "invoice_versions_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoice_versions" ADD CONSTRAINT "invoice_versions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
