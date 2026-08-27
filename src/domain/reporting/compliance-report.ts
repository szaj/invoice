import { COMPLIANCE_REVIEW_SUBJECT_TYPES, type ComplianceStatus } from "@/domain/compliance/types";
import { computeOutstandingAgeDays } from "@/domain/reporting/outstanding-report";
import {
  COMPLIANCE_REPORT_AGING_BUCKET_IDS,
  COMPLIANCE_REPORT_NOTE_REFERENCE_LIMIT,
  type ComplianceReportAgingBucket,
  type ComplianceReportAgingBucketId,
  type ComplianceReportNoteReference,
  type ComplianceReportPayload,
  type ComplianceReportSourceNote,
  type ComplianceReportSourceSubject,
  type ComplianceReportStatusCounts,
  type ComplianceReportSubjectTypeCounts,
} from "@/domain/reporting/types";

/**
 * Compliance Report domain helpers (TASK-087 / §13.3).
 * Review counts, approved/flagged/pending, aging of open items, and notes references.
 * Pending = NOT_REVIEWED + UNDER_REVIEW. Does not mutate audit or compliance records.
 */

export const COMPLIANCE_REPORT_AGING_BUCKET_LABELS: Record<ComplianceReportAgingBucketId, string> =
  {
    "0-30": "0–30 days",
    "31-60": "31–60 days",
    "61-90": "61–90 days",
    "90+": "90+ days",
  };

export function isCompliancePendingStatus(status: ComplianceStatus): boolean {
  return status === "NOT_REVIEWED" || status === "UNDER_REVIEW";
}

export function isComplianceAgingEligible(status: ComplianceStatus): boolean {
  return isCompliancePendingStatus(status) || status === "FLAGGED";
}

/**
 * Map age in days (from subject date) to a compliance aging bucket.
 * Negative ages (future dates) are excluded.
 */
export function assignComplianceAgingBucket(ageDays: number): ComplianceReportAgingBucketId | null {
  if (!Number.isFinite(ageDays) || ageDays < 0) {
    return null;
  }
  if (ageDays <= 30) {
    return "0-30";
  }
  if (ageDays <= 60) {
    return "31-60";
  }
  if (ageDays <= 90) {
    return "61-90";
  }
  return "90+";
}

function emptyStatusCounts(): {
  notReviewed: number;
  underReview: number;
  approved: number;
  flagged: number;
} {
  return { notReviewed: 0, underReview: 0, approved: 0, flagged: 0 };
}

function applyStatusCount(
  counts: ReturnType<typeof emptyStatusCounts>,
  status: ComplianceStatus,
): void {
  switch (status) {
    case "NOT_REVIEWED":
      counts.notReviewed += 1;
      break;
    case "UNDER_REVIEW":
      counts.underReview += 1;
      break;
    case "APPROVED":
      counts.approved += 1;
      break;
    case "FLAGGED":
      counts.flagged += 1;
      break;
  }
}

function toStatusCounts(
  counts: ReturnType<typeof emptyStatusCounts>,
): ComplianceReportStatusCounts {
  const pending = counts.notReviewed + counts.underReview;
  return {
    notReviewed: counts.notReviewed,
    underReview: counts.underReview,
    approved: counts.approved,
    flagged: counts.flagged,
    pending,
    total: pending + counts.approved + counts.flagged,
  };
}

function emptyAgingBuckets(): Map<
  ComplianceReportAgingBucketId,
  { pendingCount: number; flaggedCount: number }
> {
  const map = new Map<
    ComplianceReportAgingBucketId,
    { pendingCount: number; flaggedCount: number }
  >();
  for (const id of COMPLIANCE_REPORT_AGING_BUCKET_IDS) {
    map.set(id, { pendingCount: 0, flaggedCount: 0 });
  }
  return map;
}

function toAgingBuckets(
  buckets: Map<ComplianceReportAgingBucketId, { pendingCount: number; flaggedCount: number }>,
): ComplianceReportAgingBucket[] {
  return COMPLIANCE_REPORT_AGING_BUCKET_IDS.map((id) => {
    const entry = buckets.get(id)!;
    return {
      bucket: id,
      label: COMPLIANCE_REPORT_AGING_BUCKET_LABELS[id],
      pendingCount: entry.pendingCount,
      flaggedCount: entry.flaggedCount,
      totalCount: entry.pendingCount + entry.flaggedCount,
    };
  });
}

function hasNoteContent(note: ComplianceReportSourceNote): boolean {
  return (
    (note.notes != null && note.notes.trim().length > 0) ||
    (note.reason != null && note.reason.trim().length > 0) ||
    (note.resolutionNotes != null && note.resolutionNotes.trim().length > 0) ||
    (note.evidenceRefs != null && note.evidenceRefs.length > 0)
  );
}

function toNoteReference(note: ComplianceReportSourceNote): ComplianceReportNoteReference {
  return {
    reviewId: note.id,
    subjectType: note.subjectType,
    subjectId: note.subjectId,
    companyId: note.companyId,
    status: note.status,
    hasNotes: note.notes != null && note.notes.trim().length > 0,
    hasReason: note.reason != null && note.reason.trim().length > 0,
    hasResolutionNotes: note.resolutionNotes != null && note.resolutionNotes.trim().length > 0,
    evidenceRefCount: note.evidenceRefs?.length ?? 0,
    reviewerUserId: note.reviewerUserId,
    createdAt: note.createdAt.toISOString(),
    label: note.label,
  };
}

/**
 * Aggregate queue subjects + note-bearing reviews into the Compliance Report payload.
 */
export function buildComplianceReport(
  subjects: readonly ComplianceReportSourceSubject[],
  notes: readonly ComplianceReportSourceNote[],
  options: {
    readonly asOf?: Date;
    readonly noteLimit?: number;
  } = {},
): ComplianceReportPayload {
  const asOf = options.asOf ?? new Date();
  const noteLimit = options.noteLimit ?? COMPLIANCE_REPORT_NOTE_REFERENCE_LIMIT;

  const overall = emptyStatusCounts();
  const byType = new Map<
    ComplianceReportSourceSubject["subjectType"],
    ReturnType<typeof emptyStatusCounts>
  >();
  for (const subjectType of COMPLIANCE_REVIEW_SUBJECT_TYPES) {
    byType.set(subjectType, emptyStatusCounts());
  }

  const aging = emptyAgingBuckets();

  for (const subject of subjects) {
    applyStatusCount(overall, subject.complianceStatus);
    const typeCounts = byType.get(subject.subjectType);
    if (typeCounts) {
      applyStatusCount(typeCounts, subject.complianceStatus);
    }

    if (!isComplianceAgingEligible(subject.complianceStatus) || !subject.date) {
      continue;
    }
    const ageDays = computeOutstandingAgeDays(subject.date, asOf);
    const bucketId = assignComplianceAgingBucket(ageDays);
    if (!bucketId) {
      continue;
    }
    const bucket = aging.get(bucketId)!;
    if (isCompliancePendingStatus(subject.complianceStatus)) {
      bucket.pendingCount += 1;
    } else if (subject.complianceStatus === "FLAGGED") {
      bucket.flaggedCount += 1;
    }
  }

  const noteBearing = notes.filter(hasNoteContent).sort((a, b) => {
    const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return a.id.localeCompare(b.id);
  });

  const bySubjectType: ComplianceReportSubjectTypeCounts[] = COMPLIANCE_REVIEW_SUBJECT_TYPES.map(
    (subjectType) => ({
      subjectType,
      ...toStatusCounts(byType.get(subjectType)!),
    }),
  );

  return {
    statusCounts: toStatusCounts(overall),
    bySubjectType,
    aging: toAgingBuckets(aging),
    noteReferences: noteBearing.slice(0, noteLimit).map(toNoteReference),
    noteReferenceTotal: noteBearing.length,
  };
}
