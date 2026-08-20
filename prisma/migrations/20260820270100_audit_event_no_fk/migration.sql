-- TASK-012 follow-up: audit actor/company IDs are historical references.
-- Drop FKs so append-only rows remain writable for system events and survive
-- actor/company lifecycle without blocking privileged writes.

ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_actor_user_id_fkey";
ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_company_id_fkey";
