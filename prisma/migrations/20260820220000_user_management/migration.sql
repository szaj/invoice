-- TASK-006 Admin user-management fields.
-- password_reset_required remains a workflow flag only.
-- No company assignment, credentials, or audit_logs table.

ALTER TABLE "users" ADD COLUMN "employee_id" TEXT;
ALTER TABLE "users" ADD COLUMN "mfa_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "created_by_user_id" UUID;

ALTER TABLE "users"
    ADD CONSTRAINT "users_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
