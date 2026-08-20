-- TASK-015 company currency configuration.
-- Per-company enabled subset of globally active currencies + default invoice currency.
-- Reject enabling globally inactive currencies (enforced in application).
-- No settlement currencies, fixed conversion rates, or invoice issuance.

CREATE TABLE "company_currencies" (
    "company_id" UUID NOT NULL,
    "currency_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_currencies_pkey" PRIMARY KEY ("company_id","currency_id")
);

ALTER TABLE "company_currencies"
ADD CONSTRAINT "company_currencies_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_currencies"
ADD CONSTRAINT "company_currencies_currency_id_fkey"
FOREIGN KEY ("currency_id") REFERENCES "currencies"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "company_currencies_currency_id_idx" ON "company_currencies"("currency_id");
CREATE INDEX "company_currencies_company_id_is_default_idx" ON "company_currencies"("company_id", "is_default");
