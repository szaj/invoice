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
  readonly notes: string | null;
  readonly reason: string | null;
  readonly resolutionNotes: string | null;
  readonly evidenceRefs: readonly string[] | null;
  readonly reviewerUserId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export const COMPLIANCE_INVALID_INPUT = "Check the compliance details and try again.";
export const COMPLIANCE_NOTE_REQUIRED = "Add a compliance note, reason code, or resolution note.";
export const COMPLIANCE_NOT_FOUND = "Record not found.";
export const COMPLIANCE_UNAVAILABLE = "Compliance review is temporarily unavailable.";
export const COMPLIANCE_STATUS_FORBIDDEN =
  "You do not have permission to change compliance status.";
export const COMPLIANCE_NOTES_FORBIDDEN = "You do not have permission to manage compliance notes.";
export const COMPLIANCE_QUEUE_FORBIDDEN =
  "You do not have permission to view the compliance queue.";
export const COMPLIANCE_EXPORT_FORBIDDEN =
  "You do not have permission to export the compliance report.";
export const COMPLIANCE_COMPANY_REQUIRED =
  "A company context is required for this compliance review.";

/**
 * Unified compliance review queue row (TASK-072).
 * Amount/gateway are null for subject types that do not carry those fields.
 */
export type ComplianceQueueItem = {
  readonly subjectType: ComplianceReviewSubjectType;
  readonly subjectId: string;
  readonly companyId: string;
  readonly complianceStatus: ComplianceStatus;
  readonly staffUserId: string | null;
  readonly date: Date | null;
  readonly amount: string | null;
  readonly currencyCode: string | null;
  readonly gateway: string | null;
  readonly label: string | null;
  readonly customerId: string | null;
  readonly invoiceId: string | null;
};
