import { z } from "zod";

import { complianceStatusSchema } from "@/domain/compliance/schema";
import {
  INVOICE_LIST_DEFAULT_SORT_BY,
  INVOICE_LIST_DEFAULT_SORT_DIR,
  INVOICE_LIST_SORT_FIELDS,
  LIST_SORT_DIRS,
  firstSearchParam,
  resolveListPagination,
  type InvoiceListSortField,
  type ListSortDir,
} from "@/domain/lists/pagination";
import {
  INVOICE_STATUSES,
  INVOICE_COMPANY_CUSTOMER_REQUIRED,
  INVOICE_CURRENCY_REQUIRED,
  type InvoiceStatus,
} from "@/domain/invoices/types";

export const invoiceStatusSchema = z.enum(INVOICE_STATUSES);
export const invoiceComplianceStatusSchema = complianceStatusSchema;
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
 * Compliance status is not writable here — use compliance.review APIs (TASK-071).
 */
export const invoiceDraftWriteSchema = z.strictObject({
  companyId: z.uuid({ error: INVOICE_COMPANY_CUSTOMER_REQUIRED }),
  customerId: z.uuid({ error: INVOICE_COMPANY_CUSTOMER_REQUIRED }),
  invoiceDate: invoiceDateSchema,
  dueDate: invoiceDateSchema,
  currencyCode: currencyCodeSchema,
  referencePo: nullableText(200),
  assignedStaffUserId: nullableUuid,
  internalNotes: nullableText(5000),
  customerNotes: nullableText(5000),
});

export type InvoiceDraftWriteInput = z.output<typeof invoiceDraftWriteSchema>;
export type InvoiceDraftWriteFormValues = z.input<typeof invoiceDraftWriteSchema>;

const optionalPositiveInt = (min: number, max: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number.parseInt(value.trim(), 10);
      return Number.isNaN(parsed) ? value : parsed;
    }
    return value;
  }, z.number().int().min(min).max(max).optional());

export const invoiceDraftListQuerySchema = z.strictObject({
  companyId: z.uuid().optional(),
  status: invoiceStatusSchema.optional().default("DRAFT"),
  q: z.string().trim().max(64).optional(),
  page: optionalPositiveInt(1, 10_000),
  pageSize: optionalPositiveInt(1, 10_000),
  sortBy: z.enum(INVOICE_LIST_SORT_FIELDS).optional(),
  sortDir: z.enum(LIST_SORT_DIRS).optional(),
});

export type InvoiceDraftListQuery = z.output<typeof invoiceDraftListQuerySchema>;

export type ResolvedInvoiceListQuery = {
  readonly companyId?: string;
  readonly status: InvoiceStatus;
  readonly q?: string;
  readonly page: number;
  readonly pageSize: number;
  readonly sortBy: InvoiceListSortField;
  readonly sortDir: ListSortDir;
};

export function resolveInvoiceListQuery(query: InvoiceDraftListQuery): ResolvedInvoiceListQuery {
  const pagination = resolveListPagination({ page: query.page, pageSize: query.pageSize });
  return {
    companyId: query.companyId,
    status: query.status,
    q: query.q,
    page: pagination.page,
    pageSize: pagination.pageSize,
    sortBy: query.sortBy ?? INVOICE_LIST_DEFAULT_SORT_BY,
    sortDir: query.sortDir ?? INVOICE_LIST_DEFAULT_SORT_DIR,
  };
}

/** Parse list filters from Next.js searchParams (TASK-032 / TASK-036 / TASK-098). */
export function parseInvoiceDraftListSearchParams(
  params: Record<string, string | string[] | undefined>,
): InvoiceDraftListQuery {
  const statusRaw = firstSearchParam(params.status);
  const statusParsed = statusRaw ? invoiceStatusSchema.safeParse(statusRaw) : null;
  const parsed = invoiceDraftListQuerySchema.safeParse({
    companyId: firstSearchParam(params.companyId),
    status: statusParsed?.success ? statusParsed.data : "DRAFT",
    q: firstSearchParam(params.q),
    page: firstSearchParam(params.page),
    pageSize: firstSearchParam(params.pageSize),
    sortBy: firstSearchParam(params.sortBy),
    sortDir: firstSearchParam(params.sortDir),
  });
  return parsed.success ? parsed.data : { status: "DRAFT" };
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
    readonly complianceStatus?: InvoiceHeaderWriteInput["complianceStatus"];
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
    complianceStatus: options.complianceStatus ?? "NOT_REVIEWED",
    internalNotes: draft.internalNotes,
    customerNotes: draft.customerNotes,
    invoiceNumber: null,
  };
}
