-- TASK-020 settlement currency configuration on gateway config shape.
-- No encrypted credentials, environment, webhooks, or live charges (TASK-049+).

CREATE TYPE "payment_method_code" AS ENUM ('STRIPE', 'PAYPAL', 'BANK_PROCESSOR', 'MANUAL');

CREATE TABLE "payment_gateway_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "method_code" "payment_method_code" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_gateway_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_gateway_configs_company_id_method_code_key"
ON "payment_gateway_configs"("company_id", "method_code");

CREATE INDEX "payment_gateway_configs_company_id_idx"
ON "payment_gateway_configs"("company_id");

ALTER TABLE "payment_gateway_configs"
ADD CONSTRAINT "payment_gateway_configs_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "payment_gateway_settlement_currencies" (
    "gateway_config_id" UUID NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_gateway_settlement_currencies_pkey"
    PRIMARY KEY ("gateway_config_id", "currency_code")
);

CREATE INDEX "payment_gateway_settlement_currencies_currency_code_idx"
ON "payment_gateway_settlement_currencies"("currency_code");

ALTER TABLE "payment_gateway_settlement_currencies"
ADD CONSTRAINT "payment_gateway_settlement_currencies_gateway_config_id_fkey"
FOREIGN KEY ("gateway_config_id") REFERENCES "payment_gateway_configs"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
