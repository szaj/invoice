-- TASK-039: invoice PDF file metadata (blob in object storage via StorageService / ADR-006).

CREATE TABLE "invoice_files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "invoice_id" UUID NOT NULL,
    "invoice_version_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "checksum_sha256" CHAR(64) NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "content_type" TEXT NOT NULL DEFAULT 'application/pdf',
    "page_size" TEXT NOT NULL DEFAULT 'A4',
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_files_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invoice_files_invoice_version_id_key" ON "invoice_files"("invoice_version_id");
CREATE INDEX "invoice_files_invoice_id_idx" ON "invoice_files"("invoice_id");

ALTER TABLE "invoice_files" ADD CONSTRAINT "invoice_files_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_files" ADD CONSTRAINT "invoice_files_invoice_version_id_fkey" FOREIGN KEY ("invoice_version_id") REFERENCES "invoice_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_files" ADD CONSTRAINT "invoice_files_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
