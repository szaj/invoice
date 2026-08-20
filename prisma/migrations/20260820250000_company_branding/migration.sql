-- TASK-010 company branding configuration.
-- Stores brand identity used later by invoices, PDFs, and email.
-- Logo bytes remain in object storage; only validated metadata is stored here.
-- Excludes invoice sequence issuance, PDF rendering, email sending, currencies,
-- reporting groups, and gateway credentials.

ALTER TABLE "companies"
ADD COLUMN "invoice_prefix" TEXT,
ADD COLUMN "terms_and_conditions" TEXT,
ADD COLUMN "email_template_reference" TEXT,
ADD COLUMN "logo_storage_key" TEXT,
ADD COLUMN "logo_mime_type" TEXT,
ADD COLUMN "logo_byte_size" INTEGER,
ADD COLUMN "logo_original_filename" TEXT,
ADD COLUMN "logo_uploaded_at" TIMESTAMPTZ;

ALTER TABLE "companies"
ADD CONSTRAINT "companies_logo_byte_size_nonneg_chk"
CHECK ("logo_byte_size" IS NULL OR "logo_byte_size" >= 0);

ALTER TABLE "companies"
ADD CONSTRAINT "companies_logo_metadata_consistency_chk"
CHECK (
  (
    "logo_storage_key" IS NULL
    AND "logo_mime_type" IS NULL
    AND "logo_byte_size" IS NULL
    AND "logo_original_filename" IS NULL
    AND "logo_uploaded_at" IS NULL
  )
  OR (
    "logo_storage_key" IS NOT NULL
    AND "logo_mime_type" IS NOT NULL
    AND "logo_byte_size" IS NOT NULL
    AND "logo_uploaded_at" IS NOT NULL
  )
);
