-- TASK-007 company identity, address, status, and names.
-- Excludes gateway credentials, currencies, invoice numbering, branding files,
-- reporting groups, and user_companies.

CREATE TYPE "company_status" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "companies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "display_name" TEXT NOT NULL,
    "legal_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "registration_tax_number" TEXT,
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postal_code" TEXT,
    "country_code" CHAR(2),
    "status" "company_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "companies_country_code_iso_chk" CHECK ("country_code" IS NULL OR "country_code" ~ '^[A-Z]{2}$')
);
