-- TASK-099: BullMQ job metadata for retries and failure visibility.

CREATE TYPE "background_job_status" AS ENUM (
  'QUEUED',
  'ACTIVE',
  'COMPLETED',
  'FAILED',
  'DUPLICATE_SKIPPED'
);

CREATE TABLE "background_jobs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "queue_name" TEXT NOT NULL,
  "job_name" TEXT NOT NULL,
  "bull_job_id" TEXT,
  "idempotency_key" TEXT,
  "correlation_id" TEXT,
  "status" "background_job_status" NOT NULL DEFAULT 'QUEUED',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 5,
  "last_error" TEXT,
  "company_id" UUID,
  "entity_type" TEXT,
  "entity_id" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  "completed_at" TIMESTAMPTZ,

  CONSTRAINT "background_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "background_jobs_queue_name_idempotency_key_key"
  ON "background_jobs"("queue_name", "idempotency_key");

CREATE INDEX "background_jobs_status_created_at_idx"
  ON "background_jobs"("status", "created_at" DESC);

CREATE INDEX "background_jobs_queue_name_created_at_idx"
  ON "background_jobs"("queue_name", "created_at" DESC);
