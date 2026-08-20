-- TASK-003 identity mapping only.
-- No roles, permissions, companies, customers, invoices, or payments.

CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'SUSPENDED');

CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "supabase_auth_user_id" UUID NOT NULL,
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_supabase_auth_user_id_key" ON "users"("supabase_auth_user_id");
