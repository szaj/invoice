-- TASK-014 currency master.
-- Global currency catalog with defaults USD, AED, PKR, GBP, AUD.
-- Admin may add/disable. Disabled currencies remain for historical display (BR-011).
-- No company_currencies, fixed conversion rates, settlement config, or live FX.
-- Does not lock ADR-011 (reporting currency default remains OPEN / configurable).

CREATE TYPE "currency_status" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "currencies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" CHAR(3) NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimal_precision" INTEGER NOT NULL,
    "status" "currency_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "currencies_code_key" ON "currencies"("code");
CREATE INDEX "currencies_status_idx" ON "currencies"("status");

INSERT INTO "currencies" ("id", "code", "name", "symbol", "decimal_precision", "status") VALUES
    ('dddddddd-dddd-4ddd-8ddd-000000000001', 'USD', 'US Dollar', '$', 2, 'ACTIVE'),
    ('dddddddd-dddd-4ddd-8ddd-000000000002', 'AED', 'UAE Dirham', 'AED', 2, 'ACTIVE'),
    ('dddddddd-dddd-4ddd-8ddd-000000000003', 'PKR', 'Pakistani Rupee', 'Rs', 2, 'ACTIVE'),
    ('dddddddd-dddd-4ddd-8ddd-000000000004', 'GBP', 'Pound Sterling', '£', 2, 'ACTIVE'),
    ('dddddddd-dddd-4ddd-8ddd-000000000005', 'AUD', 'Australian Dollar', 'A$', 2, 'ACTIVE');
