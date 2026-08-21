-- TASK-022 customer master schema (Customers §7.1).
-- Email optional. Soft status only. No customer_companies (TASK-025).
-- No public CRUD API (TASK-023). No customer portal.

CREATE TYPE "customer_type" AS ENUM ('INDIVIDUAL', 'BUSINESS');

CREATE TYPE "customer_status" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "display_name" TEXT NOT NULL,
    "contact_person" TEXT,
    "customer_type" "customer_type" NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "alternate_phone" TEXT,
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postal_code" TEXT,
    "country_code" CHAR(2),
    "tax_registration_id" TEXT,
    "website" TEXT,
    "default_invoice_currency_code" CHAR(3),
    "default_company_id" UUID,
    "payment_preference" TEXT,
    "status" "customer_status" NOT NULL DEFAULT 'ACTIVE',
    "assigned_staff_user_id" UUID,
    "internal_notes" TEXT,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "customers_country_code_iso_chk" CHECK ("country_code" IS NULL OR "country_code" ~ '^[A-Z]{2}$'),
    CONSTRAINT "customers_default_invoice_currency_code_chk" CHECK (
      "default_invoice_currency_code" IS NULL OR "default_invoice_currency_code" ~ '^[A-Z]{3}$'
    )
);

CREATE INDEX "customers_status_idx" ON "customers"("status");
CREATE INDEX "customers_display_name_idx" ON "customers"("display_name");
CREATE INDEX "customers_email_idx" ON "customers"("email");
CREATE INDEX "customers_default_company_id_idx" ON "customers"("default_company_id");
CREATE INDEX "customers_assigned_staff_user_id_idx" ON "customers"("assigned_staff_user_id");

ALTER TABLE "customers"
  ADD CONSTRAINT "customers_default_company_id_fkey"
  FOREIGN KEY ("default_company_id") REFERENCES "companies"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "customers"
  ADD CONSTRAINT "customers_assigned_staff_user_id_fkey"
  FOREIGN KEY ("assigned_staff_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "customers"
  ADD CONSTRAINT "customers_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "customers"
  ADD CONSTRAINT "customers_updated_by_user_id_fkey"
  FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
