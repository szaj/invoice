-- TASK-012 audit event foundation.
-- Append-only application audit trail. No ordinary update/delete APIs.
-- Sensitive values must be masked before insert. UTC timestamps (timestamptz).
-- Does not add audit viewer UI, currencies, invoices, payments, or gateway tables.

CREATE TYPE "audit_actor_type" AS ENUM ('USER', 'SYSTEM', 'WEBHOOK');

CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_type" "audit_actor_type" NOT NULL,
    "actor_user_id" UUID,
    "company_id" UUID,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "action" TEXT NOT NULL,
    "old_values" JSONB,
    "new_values" JSONB,
    "reason" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "correlation_id" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- actor_user_id / company_id are historical references without FKs (see 20260820270100).

CREATE INDEX "audit_logs_occurred_at_idx" ON "audit_logs"("occurred_at");
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs"("actor_user_id");
CREATE INDEX "audit_logs_company_id_idx" ON "audit_logs"("company_id");
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
