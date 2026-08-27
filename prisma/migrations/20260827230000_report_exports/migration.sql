-- TASK-090: Report export file metadata (ADR-005 / ADR-006)

CREATE TYPE "report_export_status" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "report_export_format" AS ENUM ('CSV', 'XLSX');

CREATE TABLE "report_exports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "report_type" TEXT NOT NULL,
    "format" "report_export_format" NOT NULL,
    "status" "report_export_status" NOT NULL DEFAULT 'PENDING',
    "storage_key" TEXT,
    "checksum_sha256" CHAR(64),
    "byte_size" INTEGER,
    "content_type" TEXT,
    "filename" TEXT NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "row_count" INTEGER,
    "totals" JSONB,
    "error_message" TEXT,
    "company_id" UUID,
    "requested_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "report_exports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "report_exports_requested_by_user_id_created_at_idx" ON "report_exports"("requested_by_user_id", "created_at" DESC);
CREATE INDEX "report_exports_company_id_created_at_idx" ON "report_exports"("company_id", "created_at" DESC);

ALTER TABLE "report_exports" ADD CONSTRAINT "report_exports_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "report_exports" ADD CONSTRAINT "report_exports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
