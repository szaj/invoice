-- TASK-046 settlement conversion snapshot (BR-020 / BR-021).
-- Stores the effective timestamp of the Admin fixed-rate version used.
-- Historical payments keep this snapshot; later rate versions must not rewrite it.

ALTER TABLE "payments" ADD COLUMN "rate_effective_at" TIMESTAMPTZ;

UPDATE "payments"
SET "rate_effective_at" = "payment_date"
WHERE "rate_effective_at" IS NULL;
