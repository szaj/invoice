import { z } from "zod";

import {
  COMPLIANCE_INVALID_INPUT,
  COMPLIANCE_NOTE_REQUIRED,
  COMPLIANCE_REVIEW_SUBJECT_TYPES,
  COMPLIANCE_STATUSES,
} from "@/domain/compliance/types";
import { PAYMENT_METHOD_CODES } from "@/domain/settlement/types";

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
const nullableText = (max: number) => z.preprocess(blankToNull, z.string().max(max).nullable());

function emptyToUndefined(value: unknown): unknown {
  const next = blankToNull(value);
  return next === null ? undefined : next;
}

/** Optional evidence/attachment storage-key references when evidence is enabled. */
const optionalEvidenceRefs = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === "") {
      return null;
    }
    if (Array.isArray(value)) {
      return value;
    }
    return value;
  },
  z.array(z.string().trim().min(1).max(512)).max(20).nullable().optional(),
);

/**
 * Status update payload (TASK-071 / TASK-073).
 * Notes, reason codes, resolution notes, and optional evidence refs on approve/flag.
 * companyId is required for CUSTOMER subjects (multi-company); optional otherwise
 * (inferred from invoice/payment).
 */
export const complianceStatusUpdateSchema = z
  .strictObject({
    subjectType: complianceReviewSubjectTypeSchema,
    subjectId: complianceSubjectIdSchema,
    status: complianceStatusSchema,
    companyId: nullableUuid.optional(),
    notes: nullableText(4000).optional(),
    reason: nullableText(200).optional(),
    resolutionNotes: nullableText(4000).optional(),
    evidenceRefs: optionalEvidenceRefs,
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

/**
 * Add internal compliance notes / reason / resolution without requiring a status change (TASK-073).
 * At least one of notes, reason, or resolutionNotes is required.
 */
export const complianceNoteCreateSchema = z
  .strictObject({
    subjectType: complianceReviewSubjectTypeSchema,
    subjectId: complianceSubjectIdSchema,
    companyId: nullableUuid.optional(),
    notes: nullableText(4000).optional(),
    reason: nullableText(200).optional(),
    resolutionNotes: nullableText(4000).optional(),
    evidenceRefs: optionalEvidenceRefs,
  })
  .superRefine((value, ctx) => {
    if (value.subjectType === "CUSTOMER" && !value.companyId) {
      ctx.addIssue({
        code: "custom",
        message: COMPLIANCE_INVALID_INPUT,
        path: ["companyId"],
      });
    }
    const hasNoteContent =
      (value.notes != null && value.notes.length > 0) ||
      (value.reason != null && value.reason.length > 0) ||
      (value.resolutionNotes != null && value.resolutionNotes.length > 0);
    if (!hasNoteContent) {
      ctx.addIssue({
        code: "custom",
        message: COMPLIANCE_NOTE_REQUIRED,
        path: ["notes"],
      });
    }
  });

export type ComplianceNoteCreateInput = z.output<typeof complianceNoteCreateSchema>;

/**
 * List compliance review notes for a subject (TASK-073).
 * companyId required for CUSTOMER subjects.
 */
export const complianceNotesQuerySchema = z
  .strictObject({
    subjectType: complianceReviewSubjectTypeSchema,
    subjectId: complianceSubjectIdSchema,
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

export type ComplianceNotesQuery = z.output<typeof complianceNotesQuerySchema>;

const optionalUuid = z.preprocess(emptyToUndefined, z.uuid().optional());

const optionalCurrencyCode = z.preprocess(
  (value) => {
    const next = emptyToUndefined(value);
    return typeof next === "string" ? next.toUpperCase() : next;
  },
  z
    .string()
    .regex(/^[A-Z]{3}$/, COMPLIANCE_INVALID_INPUT)
    .optional(),
);

const optionalQueueDate = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return new Date(`${trimmed}T00:00:00.000Z`);
    }
    return new Date(trimmed);
  }
  return value;
}, z.date().optional());

/** Reject JS number so float never enters authoritative money filters (ADR-004). */
const JS_NUMBER_SENTINEL = "__JS_NUMBER__";

const optionalMoneyFilter = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }
    if (typeof value === "number") {
      return JS_NUMBER_SENTINEL;
    }
    if (typeof value === "string") {
      return value.trim();
    }
    return value;
  },
  z
    .string()
    .optional()
    .superRefine((value, ctx) => {
      if (value === undefined) {
        return;
      }
      if (value === JS_NUMBER_SENTINEL) {
        ctx.addIssue({ code: "custom", message: COMPLIANCE_INVALID_INPUT });
        return;
      }
      if (!/^-?\d+(\.\d+)?$/.test(value)) {
        ctx.addIssue({ code: "custom", message: COMPLIANCE_INVALID_INPUT });
      }
    }),
);

/**
 * Compliance review queue filters (TASK-072).
 * company / staff / date / amount / gateway / currency / status.
 */
export const complianceQueueQuerySchema = z
  .strictObject({
    companyId: optionalUuid,
    staffUserId: optionalUuid,
    dateFrom: optionalQueueDate,
    dateTo: optionalQueueDate,
    amountMin: optionalMoneyFilter,
    amountMax: optionalMoneyFilter,
    gateway: z.enum(PAYMENT_METHOD_CODES).optional(),
    currency: optionalCurrencyCode,
    status: complianceStatusSchema.optional(),
    subjectType: complianceReviewSubjectTypeSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.dateFrom && value.dateTo && value.dateFrom.getTime() > value.dateTo.getTime()) {
      ctx.addIssue({
        code: "custom",
        message: COMPLIANCE_INVALID_INPUT,
        path: ["dateFrom"],
      });
    }
  });

export type ComplianceQueueQuery = z.output<typeof complianceQueueQuerySchema>;

function firstSearchParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return undefined;
}

/**
 * Parse compliance queue page searchParams into queue query input (TASK-074).
 * Keeps filter/query logic out of React components.
 */
export function parseComplianceQueueSearchParams(
  params: Record<string, string | string[] | undefined>,
): ComplianceQueueQuery {
  const parsed = complianceQueueQuerySchema.safeParse({
    companyId: firstSearchParam(params.companyId),
    staffUserId: firstSearchParam(params.staffUserId),
    dateFrom: firstSearchParam(params.dateFrom),
    dateTo: firstSearchParam(params.dateTo),
    amountMin: firstSearchParam(params.amountMin),
    amountMax: firstSearchParam(params.amountMax),
    gateway: firstSearchParam(params.gateway),
    currency: firstSearchParam(params.currency),
    status: firstSearchParam(params.status),
    subjectType: firstSearchParam(params.subjectType),
  });
  return parsed.success ? parsed.data : {};
}

/** Map URL segment (invoice|payment|customer) to subject type enum. */
export function parseComplianceSubjectTypeParam(
  value: string,
): (typeof COMPLIANCE_REVIEW_SUBJECT_TYPES)[number] | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === "INVOICE" || normalized === "PAYMENT" || normalized === "CUSTOMER") {
    return normalized;
  }
  return null;
}
