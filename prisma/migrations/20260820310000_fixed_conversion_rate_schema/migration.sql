-- TASK-016 Admin-defined fixed conversion rates.
-- No live FX, market, or gateway rate substitution.
-- Append-only create (no in-place historical edit). Expire-previous is TASK-017.

CREATE TYPE "fixed_conversion_rate_status" AS ENUM ('ACTIVE', 'EXPIRED');
CREATE TYPE "fixed_conversion_rate_frequency" AS ENUM ('MONTHLY', 'YEARLY', 'MANUAL');

CREATE TABLE "fixed_conversion_rates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "from_currency" CHAR(3) NOT NULL,
    "to_currency" CHAR(3) NOT NULL,
    "fixed_rate" NUMERIC(20, 12) NOT NULL,
    "version_no" INTEGER NOT NULL,
    "frequency_label" "fixed_conversion_rate_frequency" NOT NULL,
    "valid_from" TIMESTAMPTZ NOT NULL,
    "valid_to" TIMESTAMPTZ,
    "status" "fixed_conversion_rate_status" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fixed_conversion_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fixed_conversion_rates_from_currency_to_currency_version_no_key"
ON "fixed_conversion_rates"("from_currency", "to_currency", "version_no");

CREATE INDEX "fixed_conversion_rates_from_currency_to_currency_status_idx"
ON "fixed_conversion_rates"("from_currency", "to_currency", "status");

CREATE INDEX "fixed_conversion_rates_valid_from_idx"
ON "fixed_conversion_rates"("valid_from");
