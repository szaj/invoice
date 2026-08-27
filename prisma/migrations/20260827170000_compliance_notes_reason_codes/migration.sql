-- TASK-073: compliance_reviews notes, reason codes, resolution notes, evidence refs.

ALTER TABLE "compliance_reviews" ADD COLUMN "notes" TEXT;
ALTER TABLE "compliance_reviews" ADD COLUMN "reason" TEXT;
ALTER TABLE "compliance_reviews" ADD COLUMN "resolution_notes" TEXT;
ALTER TABLE "compliance_reviews" ADD COLUMN "evidence_refs" JSONB;
