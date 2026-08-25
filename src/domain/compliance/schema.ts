import { z } from "zod";

import {
  COMPLIANCE_INVALID_INPUT,
  COMPLIANCE_REVIEW_SUBJECT_TYPES,
  COMPLIANCE_STATUSES,
} from "@/domain/compliance/types";

export const complianceStatusSchema = z.enum(COMPLIANCE_STATUSES);
export const complianceReviewSubjectTypeSchema = z.enum(COMPLIANCE_REVIEW_SUBJECT_TYPES);
export const complianceSubjectIdSchema = z.uuid();

function blankToNull(value: unknown): unknown {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

const nullableUuid = z.preprocess(blankToNull, z.uuid().nullable());

/**
 * Status update payload (TASK-071). Notes/reason codes are TASK-073.
 * companyId is required for CUSTOMER subjects (multi-company); optional otherwise
 * (inferred from invoice/payment).
 */
export const complianceStatusUpdateSchema = z
  .strictObject({
    subjectType: complianceReviewSubjectTypeSchema,
    subjectId: complianceSubjectIdSchema,
    status: complianceStatusSchema,
    companyId: nullableUuid.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.subjectType === "CUSTOMER" && !value.companyId) {
      ctx.addIssue({
        code: "custom",
        message: COMPLIANCE_INVALID_INPUT,
        path: ["companyId"],
      });
    }
  });

export type ComplianceStatusUpdateInput = z.output<typeof complianceStatusUpdateSchema>;
