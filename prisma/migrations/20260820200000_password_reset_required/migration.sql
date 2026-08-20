-- TASK-004 password-reset-required workflow flag.
-- This is not a password, password hash, or reset token.

ALTER TABLE "users" ADD COLUMN "password_reset_required" BOOLEAN NOT NULL DEFAULT false;
