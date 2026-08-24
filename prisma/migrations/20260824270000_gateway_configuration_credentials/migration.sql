-- TASK-049: company gateway configuration + ADR-022 credential envelope on payment_gateway_configs.
-- Reuses TASK-020 table; does not create a competing configuration model.
-- Never stores plaintext credentials. Credentials are never on payments.

CREATE TYPE "gateway_environment" AS ENUM ('SANDBOX', 'LIVE');

ALTER TABLE "payment_gateway_configs"
ADD COLUMN "environment" "gateway_environment",
ADD COLUMN "provider_config" JSONB,
ADD COLUMN "credentials_ciphertext" BYTEA,
ADD COLUMN "credentials_nonce" BYTEA,
ADD COLUMN "credentials_auth_tag" BYTEA,
ADD COLUMN "wrapped_dek" BYTEA,
ADD COLUMN "dek_wrap_nonce" BYTEA,
ADD COLUMN "dek_wrap_auth_tag" BYTEA,
ADD COLUMN "kek_key_version" INTEGER,
ADD COLUMN "encryption_format_version" INTEGER;
