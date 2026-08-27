import { z } from "zod";

import { COMPLIANCE_STATUSES } from "@/domain/compliance/types";
import { INVOICE_STATUSES } from "@/domain/invoices/types";
import { PAYMENT_STATUSES } from "@/domain/payments/types";
import {
  CUSTOMER_REPORT_DEFAULT_PAGE_SIZE,
  CUSTOMER_REPORT_DEFAULT_SORT_BY,
  CUSTOMER_REPORT_DEFAULT_SORT_DIR,
  CUSTOMER_REPORT_INVALID_INPUT,
  CUSTOMER_REPORT_MAX_PAGE_SIZE,
  CUSTOMER_REPORT_SORT_DIRS,
  CUSTOMER_REPORT_SORT_FIELDS,
  DASHBOARD_INVALID_INPUT,
  INVOICE_REPORT_DEFAULT_PAGE_SIZE,
  INVOICE_REPORT_DEFAULT_SORT_BY,
  INVOICE_REPORT_DEFAULT_SORT_DIR,
  INVOICE_REPORT_INVALID_INPUT,
  INVOICE_REPORT_MAX_PAGE_SIZE,
  INVOICE_REPORT_SORT_DIRS,
  INVOICE_REPORT_SORT_FIELDS,
  OUTSTANDING_REPORT_DEFAULT_PAGE_SIZE,
  OUTSTANDING_REPORT_DEFAULT_SORT_BY,
  OUTSTANDING_REPORT_DEFAULT_SORT_DIR,
  OUTSTANDING_REPORT_INVALID_INPUT,
  OUTSTANDING_REPORT_MAX_PAGE_SIZE,
  OUTSTANDING_REPORT_SORT_DIRS,
  OUTSTANDING_REPORT_SORT_FIELDS,
  PAYMENT_REPORT_DEFAULT_PAGE_SIZE,
  PAYMENT_REPORT_DEFAULT_SORT_BY,
  PAYMENT_REPORT_DEFAULT_SORT_DIR,
  PAYMENT_REPORT_INVALID_INPUT,
  PAYMENT_REPORT_MAX_PAGE_SIZE,
  PAYMENT_REPORT_SORT_DIRS,
  PAYMENT_REPORT_SORT_FIELDS,
} from "@/domain/reporting/types";
import { PAYMENT_METHOD_CODES } from "@/domain/settlement/types";

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

function emptyToUndefined(value: unknown): unknown {
  const next = blankToNull(value);
  return next === null ? undefined : next;
}

const optionalUuid = z.preprocess(emptyToUndefined, z.uuid().optional());

const optionalCurrencyCode = z.preprocess(
  (value) => {
    const next = emptyToUndefined(value);
    return typeof next === "string" ? next.toUpperCase() : next;
  },
  z
    .string()
    .regex(/^[A-Z]{3}$/, DASHBOARD_INVALID_INPUT)
    .optional(),
);

const optionalCountryCode = z.preprocess(
  (value) => {
    const next = emptyToUndefined(value);
    return typeof next === "string" ? next.toUpperCase() : next;
  },
  z
    .string()
    .regex(/^[A-Z]{2}$/, DASHBOARD_INVALID_INPUT)
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

/**
 * Dashboard KPI filters from Dashboard and Reporting §13.2 (as applicable for TASK-077).
 * Invoice-side metrics use invoiceDate; payment-side metrics use paymentDate.
 * Does not invent a reporting-currency rollup while ADR-011 remains OPEN.
 */
export const dashboardKpiQuerySchema = z
  .strictObject({
    companyId: optionalUuid,
    customerId: optionalUuid,
    staffUserId: optionalUuid,
    reportingGroupId: optionalUuid,
    dateFrom: optionalQueueDate,
    dateTo: optionalQueueDate,
    invoiceStatus: z.enum(INVOICE_STATUSES).optional(),
    paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
    paymentMethod: z.enum(PAYMENT_METHOD_CODES).optional(),
    invoiceCurrency: optionalCurrencyCode,
    settlementCurrency: optionalCurrencyCode,
    countryCode: optionalCountryCode,
    complianceStatus: z.enum(COMPLIANCE_STATUSES).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.dateFrom && value.dateTo && value.dateFrom.getTime() > value.dateTo.getTime()) {
      ctx.addIssue({
        code: "custom",
        message: DASHBOARD_INVALID_INPUT,
        path: ["dateFrom"],
      });
    }
  });

export type DashboardKpiQuery = z.output<typeof dashboardKpiQuerySchema>;

function firstSearchParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return undefined;
}

/**
 * Parse dashboard page searchParams into KPI query input.
 */
export function parseDashboardKpiSearchParams(
  params: Record<string, string | string[] | undefined>,
): DashboardKpiQuery {
  const parsed = dashboardKpiQuerySchema.safeParse({
    companyId: firstSearchParam(params.companyId),
    customerId: firstSearchParam(params.customerId),
    staffUserId: firstSearchParam(params.staffUserId),
    reportingGroupId: firstSearchParam(params.reportingGroupId),
    dateFrom: firstSearchParam(params.dateFrom),
    dateTo: firstSearchParam(params.dateTo),
    invoiceStatus: firstSearchParam(params.invoiceStatus),
    paymentStatus: firstSearchParam(params.paymentStatus),
    paymentMethod: firstSearchParam(params.paymentMethod),
    invoiceCurrency: firstSearchParam(params.invoiceCurrency),
    settlementCurrency: firstSearchParam(params.settlementCurrency),
    countryCode: firstSearchParam(params.countryCode),
    complianceStatus: firstSearchParam(params.complianceStatus),
  });
  return parsed.success ? parsed.data : {};
}

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

/**
 * Invoice Report filters (§13.2 as applicable) + pagination/sort (TASK-078).
 * Does not invent a reporting-currency rollup while ADR-011 remains OPEN.
 */
export const invoiceReportQuerySchema = z
  .strictObject({
    companyId: optionalUuid,
    customerId: optionalUuid,
    staffUserId: optionalUuid,
    reportingGroupId: optionalUuid,
    dateFrom: optionalQueueDate,
    dateTo: optionalQueueDate,
    invoiceStatus: z.enum(INVOICE_STATUSES).optional(),
    invoiceCurrency: optionalCurrencyCode,
    countryCode: optionalCountryCode,
    complianceStatus: z.enum(COMPLIANCE_STATUSES).optional(),
    page: optionalPositiveInt(1, 10_000),
    pageSize: optionalPositiveInt(1, INVOICE_REPORT_MAX_PAGE_SIZE),
    sortBy: z.enum(INVOICE_REPORT_SORT_FIELDS).optional(),
    sortDir: z.enum(INVOICE_REPORT_SORT_DIRS).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.dateFrom && value.dateTo && value.dateFrom.getTime() > value.dateTo.getTime()) {
      ctx.addIssue({
        code: "custom",
        message: INVOICE_REPORT_INVALID_INPUT,
        path: ["dateFrom"],
      });
    }
  });

export type InvoiceReportQuery = z.output<typeof invoiceReportQuerySchema>;

export type ResolvedInvoiceReportQuery = InvoiceReportQuery & {
  readonly page: number;
  readonly pageSize: number;
  readonly sortBy: (typeof INVOICE_REPORT_SORT_FIELDS)[number];
  readonly sortDir: (typeof INVOICE_REPORT_SORT_DIRS)[number];
};

export function resolveInvoiceReportQuery(query: InvoiceReportQuery): ResolvedInvoiceReportQuery {
  return {
    ...query,
    page: query.page ?? 1,
    pageSize: query.pageSize ?? INVOICE_REPORT_DEFAULT_PAGE_SIZE,
    sortBy: query.sortBy ?? INVOICE_REPORT_DEFAULT_SORT_BY,
    sortDir: query.sortDir ?? INVOICE_REPORT_DEFAULT_SORT_DIR,
  };
}

/**
 * Parse invoice report page searchParams into query input (TASK-078).
 */
export function parseInvoiceReportSearchParams(
  params: Record<string, string | string[] | undefined>,
): InvoiceReportQuery {
  const parsed = invoiceReportQuerySchema.safeParse({
    companyId: firstSearchParam(params.companyId),
    customerId: firstSearchParam(params.customerId),
    staffUserId: firstSearchParam(params.staffUserId),
    reportingGroupId: firstSearchParam(params.reportingGroupId),
    dateFrom: firstSearchParam(params.dateFrom),
    dateTo: firstSearchParam(params.dateTo),
    invoiceStatus: firstSearchParam(params.invoiceStatus),
    invoiceCurrency: firstSearchParam(params.invoiceCurrency),
    countryCode: firstSearchParam(params.countryCode),
    complianceStatus: firstSearchParam(params.complianceStatus),
    page: firstSearchParam(params.page),
    pageSize: firstSearchParam(params.pageSize),
    sortBy: firstSearchParam(params.sortBy),
    sortDir: firstSearchParam(params.sortDir),
  });
  return parsed.success ? parsed.data : {};
}

/**
 * Payment Report filters (§13.2 as applicable) + pagination/sort (TASK-079).
 * Stored snapshots only — does not accept live rate overrides (BR-020/021).
 * Does not invent a reporting-currency rollup while ADR-011 remains OPEN.
 */
export const paymentReportQuerySchema = z
  .strictObject({
    companyId: optionalUuid,
    customerId: optionalUuid,
    staffUserId: optionalUuid,
    reportingGroupId: optionalUuid,
    dateFrom: optionalQueueDate,
    dateTo: optionalQueueDate,
    paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
    paymentMethod: z.enum(PAYMENT_METHOD_CODES).optional(),
    invoiceCurrency: optionalCurrencyCode,
    settlementCurrency: optionalCurrencyCode,
    countryCode: optionalCountryCode,
    complianceStatus: z.enum(COMPLIANCE_STATUSES).optional(),
    page: optionalPositiveInt(1, 10_000),
    pageSize: optionalPositiveInt(1, PAYMENT_REPORT_MAX_PAGE_SIZE),
    sortBy: z.enum(PAYMENT_REPORT_SORT_FIELDS).optional(),
    sortDir: z.enum(PAYMENT_REPORT_SORT_DIRS).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.dateFrom && value.dateTo && value.dateFrom.getTime() > value.dateTo.getTime()) {
      ctx.addIssue({
        code: "custom",
        message: PAYMENT_REPORT_INVALID_INPUT,
        path: ["dateFrom"],
      });
    }
  });

export type PaymentReportQuery = z.output<typeof paymentReportQuerySchema>;

export type ResolvedPaymentReportQuery = PaymentReportQuery & {
  readonly page: number;
  readonly pageSize: number;
  readonly sortBy: (typeof PAYMENT_REPORT_SORT_FIELDS)[number];
  readonly sortDir: (typeof PAYMENT_REPORT_SORT_DIRS)[number];
};

export function resolvePaymentReportQuery(query: PaymentReportQuery): ResolvedPaymentReportQuery {
  return {
    ...query,
    page: query.page ?? 1,
    pageSize: query.pageSize ?? PAYMENT_REPORT_DEFAULT_PAGE_SIZE,
    sortBy: query.sortBy ?? PAYMENT_REPORT_DEFAULT_SORT_BY,
    sortDir: query.sortDir ?? PAYMENT_REPORT_DEFAULT_SORT_DIR,
  };
}

/**
 * Parse payment report page searchParams into query input (TASK-079).
 */
export function parsePaymentReportSearchParams(
  params: Record<string, string | string[] | undefined>,
): PaymentReportQuery {
  const parsed = paymentReportQuerySchema.safeParse({
    companyId: firstSearchParam(params.companyId),
    customerId: firstSearchParam(params.customerId),
    staffUserId: firstSearchParam(params.staffUserId),
    reportingGroupId: firstSearchParam(params.reportingGroupId),
    dateFrom: firstSearchParam(params.dateFrom),
    dateTo: firstSearchParam(params.dateTo),
    paymentStatus: firstSearchParam(params.paymentStatus),
    paymentMethod: firstSearchParam(params.paymentMethod),
    invoiceCurrency: firstSearchParam(params.invoiceCurrency),
    settlementCurrency: firstSearchParam(params.settlementCurrency),
    countryCode: firstSearchParam(params.countryCode),
    complianceStatus: firstSearchParam(params.complianceStatus),
    page: firstSearchParam(params.page),
    pageSize: firstSearchParam(params.pageSize),
    sortBy: firstSearchParam(params.sortBy),
    sortDir: firstSearchParam(params.sortDir),
  });
  return parsed.success ? parsed.data : {};
}

/**
 * Outstanding Report filters (§13.2 as applicable) + pagination/sort (TASK-080).
 * Collectible open balances only — cancelled excluded by default (BR-019).
 * Does not invent a reporting-currency rollup while ADR-011 remains OPEN.
 */
export const outstandingReportQuerySchema = z
  .strictObject({
    companyId: optionalUuid,
    customerId: optionalUuid,
    staffUserId: optionalUuid,
    reportingGroupId: optionalUuid,
    dateFrom: optionalQueueDate,
    dateTo: optionalQueueDate,
    invoiceStatus: z.enum(INVOICE_STATUSES).optional(),
    invoiceCurrency: optionalCurrencyCode,
    countryCode: optionalCountryCode,
    complianceStatus: z.enum(COMPLIANCE_STATUSES).optional(),
    page: optionalPositiveInt(1, 10_000),
    pageSize: optionalPositiveInt(1, OUTSTANDING_REPORT_MAX_PAGE_SIZE),
    sortBy: z.enum(OUTSTANDING_REPORT_SORT_FIELDS).optional(),
    sortDir: z.enum(OUTSTANDING_REPORT_SORT_DIRS).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.dateFrom && value.dateTo && value.dateFrom.getTime() > value.dateTo.getTime()) {
      ctx.addIssue({
        code: "custom",
        message: OUTSTANDING_REPORT_INVALID_INPUT,
        path: ["dateFrom"],
      });
    }
  });

export type OutstandingReportQuery = z.output<typeof outstandingReportQuerySchema>;

export type ResolvedOutstandingReportQuery = OutstandingReportQuery & {
  readonly page: number;
  readonly pageSize: number;
  readonly sortBy: (typeof OUTSTANDING_REPORT_SORT_FIELDS)[number];
  readonly sortDir: (typeof OUTSTANDING_REPORT_SORT_DIRS)[number];
};

export function resolveOutstandingReportQuery(
  query: OutstandingReportQuery,
): ResolvedOutstandingReportQuery {
  return {
    ...query,
    page: query.page ?? 1,
    pageSize: query.pageSize ?? OUTSTANDING_REPORT_DEFAULT_PAGE_SIZE,
    sortBy: query.sortBy ?? OUTSTANDING_REPORT_DEFAULT_SORT_BY,
    sortDir: query.sortDir ?? OUTSTANDING_REPORT_DEFAULT_SORT_DIR,
  };
}

/**
 * Parse outstanding report page searchParams into query input (TASK-080).
 */
export function parseOutstandingReportSearchParams(
  params: Record<string, string | string[] | undefined>,
): OutstandingReportQuery {
  const parsed = outstandingReportQuerySchema.safeParse({
    companyId: firstSearchParam(params.companyId),
    customerId: firstSearchParam(params.customerId),
    staffUserId: firstSearchParam(params.staffUserId),
    reportingGroupId: firstSearchParam(params.reportingGroupId),
    dateFrom: firstSearchParam(params.dateFrom),
    dateTo: firstSearchParam(params.dateTo),
    invoiceStatus: firstSearchParam(params.invoiceStatus),
    invoiceCurrency: firstSearchParam(params.invoiceCurrency),
    countryCode: firstSearchParam(params.countryCode),
    complianceStatus: firstSearchParam(params.complianceStatus),
    page: firstSearchParam(params.page),
    pageSize: firstSearchParam(params.pageSize),
    sortBy: firstSearchParam(params.sortBy),
    sortDir: firstSearchParam(params.sortDir),
  });
  return parsed.success ? parsed.data : {};
}

/**
 * Overdue Aging Report filters (§13.2 as applicable) (TASK-081).
 * Past-due open balances only (BR-018). Does not invent ADR-011 rollup.
 */
export const overdueAgingQuerySchema = z.strictObject({
  companyId: optionalUuid,
  customerId: optionalUuid,
  staffUserId: optionalUuid,
  reportingGroupId: optionalUuid,
  invoiceCurrency: optionalCurrencyCode,
  countryCode: optionalCountryCode,
  complianceStatus: z.enum(COMPLIANCE_STATUSES).optional(),
});

export type OverdueAgingQuery = z.output<typeof overdueAgingQuerySchema>;

/**
 * Parse overdue aging report page searchParams into query input (TASK-081).
 */
export function parseOverdueAgingSearchParams(
  params: Record<string, string | string[] | undefined>,
): OverdueAgingQuery {
  const parsed = overdueAgingQuerySchema.safeParse({
    companyId: firstSearchParam(params.companyId),
    customerId: firstSearchParam(params.customerId),
    staffUserId: firstSearchParam(params.staffUserId),
    reportingGroupId: firstSearchParam(params.reportingGroupId),
    invoiceCurrency: firstSearchParam(params.invoiceCurrency),
    countryCode: firstSearchParam(params.countryCode),
    complianceStatus: firstSearchParam(params.complianceStatus),
  });
  return parsed.success ? parsed.data : {};
}

/**
 * Customer Report filters (§13.2 as applicable) + pagination/sort (TASK-082).
 * Totals stay per customer × invoice currency — no unlabeled mixed total (BR-013).
 * Does not invent a reporting-currency rollup while ADR-011 remains OPEN.
 */
export const customerReportQuerySchema = z
  .strictObject({
    companyId: optionalUuid,
    customerId: optionalUuid,
    staffUserId: optionalUuid,
    reportingGroupId: optionalUuid,
    dateFrom: optionalQueueDate,
    dateTo: optionalQueueDate,
    invoiceStatus: z.enum(INVOICE_STATUSES).optional(),
    invoiceCurrency: optionalCurrencyCode,
    countryCode: optionalCountryCode,
    complianceStatus: z.enum(COMPLIANCE_STATUSES).optional(),
    page: optionalPositiveInt(1, 10_000),
    pageSize: optionalPositiveInt(1, CUSTOMER_REPORT_MAX_PAGE_SIZE),
    sortBy: z.enum(CUSTOMER_REPORT_SORT_FIELDS).optional(),
    sortDir: z.enum(CUSTOMER_REPORT_SORT_DIRS).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.dateFrom && value.dateTo && value.dateFrom.getTime() > value.dateTo.getTime()) {
      ctx.addIssue({
        code: "custom",
        message: CUSTOMER_REPORT_INVALID_INPUT,
        path: ["dateFrom"],
      });
    }
  });

export type CustomerReportQuery = z.output<typeof customerReportQuerySchema>;

export type ResolvedCustomerReportQuery = CustomerReportQuery & {
  readonly page: number;
  readonly pageSize: number;
  readonly sortBy: (typeof CUSTOMER_REPORT_SORT_FIELDS)[number];
  readonly sortDir: (typeof CUSTOMER_REPORT_SORT_DIRS)[number];
};

export function resolveCustomerReportQuery(
  query: CustomerReportQuery,
): ResolvedCustomerReportQuery {
  return {
    ...query,
    page: query.page ?? 1,
    pageSize: query.pageSize ?? CUSTOMER_REPORT_DEFAULT_PAGE_SIZE,
    sortBy: query.sortBy ?? CUSTOMER_REPORT_DEFAULT_SORT_BY,
    sortDir: query.sortDir ?? CUSTOMER_REPORT_DEFAULT_SORT_DIR,
  };
}

/**
 * Parse customer report page searchParams into query input (TASK-082).
 */
export function parseCustomerReportSearchParams(
  params: Record<string, string | string[] | undefined>,
): CustomerReportQuery {
  const parsed = customerReportQuerySchema.safeParse({
    companyId: firstSearchParam(params.companyId),
    customerId: firstSearchParam(params.customerId),
    staffUserId: firstSearchParam(params.staffUserId),
    reportingGroupId: firstSearchParam(params.reportingGroupId),
    dateFrom: firstSearchParam(params.dateFrom),
    dateTo: firstSearchParam(params.dateTo),
    invoiceStatus: firstSearchParam(params.invoiceStatus),
    invoiceCurrency: firstSearchParam(params.invoiceCurrency),
    countryCode: firstSearchParam(params.countryCode),
    complianceStatus: firstSearchParam(params.complianceStatus),
    page: firstSearchParam(params.page),
    pageSize: firstSearchParam(params.pageSize),
    sortBy: firstSearchParam(params.sortBy),
    sortDir: firstSearchParam(params.sortDir),
  });
  return parsed.success ? parsed.data : {};
}
