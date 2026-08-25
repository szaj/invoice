export const COMPLIANCE_STATUSES = ["NOT_REVIEWED", "UNDER_REVIEW", "APPROVED", "FLAGGED"] as const;

export type ComplianceStatus = (typeof COMPLIANCE_STATUSES)[number];

export const COMPLIANCE_REVIEW_SUBJECT_TYPES = ["INVOICE", "PAYMENT", "CUSTOMER"] as const;

export type ComplianceReviewSubjectType = (typeof COMPLIANCE_REVIEW_SUBJECT_TYPES)[number];

export type ComplianceReviewRecord = {
  readonly id: string;
  readonly companyId: string;
  readonly subjectType: ComplianceReviewSubjectType;
  readonly subjectId: string;
  readonly status: ComplianceStatus;
  readonly reviewerUserId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export const COMPLIANCE_INVALID_INPUT = "Check the compliance details and try again.";
export const COMPLIANCE_NOT_FOUND = "Record not found.";
export const COMPLIANCE_UNAVAILABLE = "Compliance review is temporarily unavailable.";
export const COMPLIANCE_STATUS_FORBIDDEN =
  "You do not have permission to change compliance status.";
export const COMPLIANCE_COMPANY_REQUIRED =
  "A company context is required for this compliance review.";
