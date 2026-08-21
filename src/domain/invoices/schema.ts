import { z } from "zod";

import {
  INVOICE_COMPLIANCE_STATUSES,
  INVOICE_STATUSES,
  INVOICE_COMPANY_CUSTOMER_REQUIRED,
  INVOICE_CURRENCY_REQUIRED,
  type InvoiceStatus,
} from "@/domain/invoices/types";

export const invoiceStatusSchema = z.enum(INVOICE_STATUSES);
export const invoiceComplianceStatusSchema = z.enum(INVOICE_COMPLIANCE_STATUSES);
export const invoiceIdSchema = z.uuid();

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

const nullableText = (max: number) => z.preprocess(blankToNull, z.string().max(max).nullable());

const currencyCodeSchema = z.preprocess(
  (value) => {
    const next = blankToNull(value);
    return typeof next === "string" ? next.toUpperCase() : next;
  },
  z
    .string({ error: INVOICE_CURRENCY_REQUIRED })
    .regex(/^[A-Z]{3}$/, "Currency code must be a 3-letter ISO-style code."),
);

const nullableUuid = z.preprocess(blankToNull, z.uuid().nullable());

/**
 * Coerce date-only / ISO strings to Date at UTC midnight for DATE columns.
 */
const invoiceDateSchema = z.preprocess(
  (value) => {
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
  },
  z.date({ error: "Invoice date is required" }),
);

/**
 * Invoice header write schema (TASK-030).
 * BR-001: companyId and customerId are required (exactly one each).
 * BR-002 company enablement of currency is enforced when drafting (TASK-031).
 * Transactional create requires a concrete company context (TASK-009) — callers use
 * requireConcreteCompanyId / assertTransactionalCompanyScope.
 */
export const invoiceHeaderWriteSchema = z
  .strictObject({
    companyId: z.uuid({ error: INVOICE_COMPANY_CUSTOMER_REQUIRED }),
    customerId: z.uuid({ error: INVOICE_COMPANY_CUSTOMER_REQUIRED }),
    invoiceDate: invoiceDateSchema,
    dueDate: invoiceDateSchema,
    currencyCode: currencyCodeSchema,
    referencePo: nullableText(200),
    assignedStaffUserId: nullableUuid,
    status: invoiceStatusSchema.optional().default("DRAFT"),
    complianceStatus: invoiceComplianceStatusSchema.optional().default("NOT_REVIEWED"),
    internalNotes: nullableText(5000),
    customerNotes: nullableText(5000),
    /** Numbering is TASK-035; drafts leave this unset. */
    invoiceNumber: nullableText(64).optional().default(null),
  })
  .superRefine((value, ctx) => {
    if (!value.companyId || !value.customerId) {
      ctx.addIssue({
        code: "custom",
        message: INVOICE_COMPANY_CUSTOMER_REQUIRED,
        path: ["companyId"],
      });
    }
  });

export type InvoiceHeaderWriteInput = z.output<typeof invoiceHeaderWriteSchema>;
export type InvoiceHeaderWriteFormValues = z.input<typeof invoiceHeaderWriteSchema>;

/**
 * Draft create/update payload (TASK-031). Status and invoice number are server-controlled.
 */
export const invoiceDraftWriteSchema = z.strictObject({
  companyId: z.uuid({ error: INVOICE_COMPANY_CUSTOMER_REQUIRED }),
  customerId: z.uuid({ error: INVOICE_COMPANY_CUSTOMER_REQUIRED }),
  invoiceDate: invoiceDateSchema,
  dueDate: invoiceDateSchema,
  currencyCode: currencyCodeSchema,
  referencePo: nullableText(200),
  assignedStaffUserId: nullableUuid,
  complianceStatus: invoiceComplianceStatusSchema.optional().default("NOT_REVIEWED"),
  internalNotes: nullableText(5000),
  customerNotes: nullableText(5000),
});

export type InvoiceDraftWriteInput = z.output<typeof invoiceDraftWriteSchema>;
export type InvoiceDraftWriteFormValues = z.input<typeof invoiceDraftWriteSchema>;

export const invoiceDraftListQuerySchema = z.strictObject({
  companyId: z.uuid().optional(),
  status: invoiceStatusSchema.optional().default("DRAFT"),
});

export type InvoiceDraftListQuery = z.output<typeof invoiceDraftListQuerySchema>;

/** Parse list filters from Next.js searchParams (TASK-032 / TASK-036). */
export function parseInvoiceDraftListSearchParams(
  params: Record<string, string | string[] | undefined>,
): { companyId?: string; status?: InvoiceStatus } {
  const companyIdRaw = params.companyId;
  const companyId =
    typeof companyIdRaw === "string" && companyIdRaw.length > 0 ? companyIdRaw : undefined;
  const statusRaw = params.status;
  const statusParsed =
    typeof statusRaw === "string" ? invoiceStatusSchema.safeParse(statusRaw) : null;
  return {
    companyId,
    status: statusParsed?.success ? statusParsed.data : "DRAFT",
  };
}

export function toDateInputValue(value: Date | string | null | undefined): string {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value.slice(0, 10);
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return "";
    }
    return parsed.toISOString().slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

export function toInvoiceHeaderWriteFromDraft(
  draft: InvoiceDraftWriteInput,
  options: {
    readonly assignedStaffUserId: string | null;
    readonly status?: "DRAFT";
  },
): InvoiceHeaderWriteInput {
  return {
    companyId: draft.companyId,
    customerId: draft.customerId,
    invoiceDate: draft.invoiceDate,
    dueDate: draft.dueDate,
    currencyCode: draft.currencyCode,
    referencePo: draft.referencePo,
    assignedStaffUserId: options.assignedStaffUserId,
    status: options.status ?? "DRAFT",
    complianceStatus: draft.complianceStatus,
    internalNotes: draft.internalNotes,
    customerNotes: draft.customerNotes,
    invoiceNumber: null,
  };
}
