-- TASK-027 internal-only customer notes (author + timestamp).
-- Never customer-portal visible. Never PDF/email payload content.

CREATE TYPE "customer_note_visibility" AS ENUM ('INTERNAL');

CREATE TABLE "customer_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" "customer_note_visibility" NOT NULL DEFAULT 'INTERNAL',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "customer_notes_customer_id_created_at_idx" ON "customer_notes"("customer_id", "created_at");
CREATE INDEX "customer_notes_author_user_id_idx" ON "customer_notes"("author_user_id");

ALTER TABLE "customer_notes"
  ADD CONSTRAINT "customer_notes_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_notes"
  ADD CONSTRAINT "customer_notes_author_user_id_fkey"
  FOREIGN KEY ("author_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
