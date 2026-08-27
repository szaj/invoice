import { z } from "zod";

import { COMPLIANCE_REVIEW_SUBJECT_TYPES, COMPLIANCE_STATUSES } from "@/domain/compliance/types";
import { INVOICE_STATUSES } from "@/domain/invoices/types";
import { PAYMENT_STATUSES } from "@/domain/payments/types";
import {
  COMPANY_PERFORMANCE_DEFAULT_PAGE_SIZE,
  COMPANY_PERFORMANCE_DEFAULT_SORT_BY,
  COMPANY_PERFORMANCE_DEFAULT_SORT_DIR,
  COMPANY_PERFORMANCE_INVALID_INPUT,
  COMPANY_PERFORMANCE_MAX_PAGE_SIZE,
  COMPANY_PERFORMANCE_SORT_DIRS,
  COMPANY_PERFORMANCE_SORT_FIELDS,
  COMPLIANCE_REPORT_INVALID_INPUT,
  CURRENCY_REPORT_DEFAULT_SORT_BY,
  CURRENCY_REPORT_DEFAULT_SORT_DIR,
  CURRENCY_REPORT_INVALID_INPUT,
  CURRENCY_REPORT_SORT_DIRS,
  CURRENCY_REPORT_SORT_FIELDS,
  GATEWAY_REPORT_DEFAULT_PAGE_SIZE,
  GATEWAY_REPORT_DEFAULT_SORT_BY,
  GATEWAY_REPORT_DEFAULT_SORT_DIR,
  GATEWAY_REPORT_INVALID_INPUT,
  GATEWAY_REPORT_MAX_PAGE_SIZE,
  GATEWAY_REPORT_SORT_DIRS,
  GATEWAY_REPORT_SORT_FIELDS,
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
  STAFF_PERFORMANCE_DEFAULT_PAGE_SIZE,
  STAFF_PERFORMANCE_DEFAULT_SORT_BY,
  STAFF_PERFORMANCE_DEFAULT_SORT_DIR,
  STAFF_PERFORMANCE_INVALID_INPUT,
  STAFF_PERFORMANCE_MAX_PAGE_SIZE,
  STAFF_PERFORMANCE_SORT_DIRS,
  STAFF_PERFORMANCE_SORT_FIELDS,
  MONTHLY_BRAND_MATRIX_INVALID_INPUT,
  MONTHLY_BRAND_MATRIX_MAX_YEAR,
  MONTHLY_BRAND_MATRIX_MIN_YEAR,
  REPORTING_GROUP_ROLLUP_INVALID_INPUT,
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

/**
 * Company Performance filters (§13.2 as applicable) + pagination/sort (TASK-083).
 * KPIs stay per owning company × currency — reporting group never becomes ownership.
 * Does not invent a reporting-currency rollup while ADR-011 remains OPEN.
 */
export const companyPerformanceQuerySchema = z
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
    page: optionalPositiveInt(1, 10_000),
    pageSize: optionalPositiveInt(1, COMPANY_PERFORMANCE_MAX_PAGE_SIZE),
    sortBy: z.enum(COMPANY_PERFORMANCE_SORT_FIELDS).optional(),
    sortDir: z.enum(COMPANY_PERFORMANCE_SORT_DIRS).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.dateFrom && value.dateTo && value.dateFrom.getTime() > value.dateTo.getTime()) {
      ctx.addIssue({
        code: "custom",
        message: COMPANY_PERFORMANCE_INVALID_INPUT,
        path: ["dateFrom"],
      });
    }
  });

export type CompanyPerformanceQuery = z.output<typeof companyPerformanceQuerySchema>;

export type ResolvedCompanyPerformanceQuery = CompanyPerformanceQuery & {
  readonly page: number;
  readonly pageSize: number;
  readonly sortBy: (typeof COMPANY_PERFORMANCE_SORT_FIELDS)[number];
  readonly sortDir: (typeof COMPANY_PERFORMANCE_SORT_DIRS)[number];
};

export function resolveCompanyPerformanceQuery(
  query: CompanyPerformanceQuery,
): ResolvedCompanyPerformanceQuery {
  return {
    ...query,
    page: query.page ?? 1,
    pageSize: query.pageSize ?? COMPANY_PERFORMANCE_DEFAULT_PAGE_SIZE,
    sortBy: query.sortBy ?? COMPANY_PERFORMANCE_DEFAULT_SORT_BY,
    sortDir: query.sortDir ?? COMPANY_PERFORMANCE_DEFAULT_SORT_DIR,
  };
}

/**
 * Parse company performance page searchParams into query input (TASK-083).
 */
export function parseCompanyPerformanceSearchParams(
  params: Record<string, string | string[] | undefined>,
): CompanyPerformanceQuery {
  const parsed = companyPerformanceQuerySchema.safeParse({
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
    page: firstSearchParam(params.page),
    pageSize: firstSearchParam(params.pageSize),
    sortBy: firstSearchParam(params.sortBy),
    sortDir: firstSearchParam(params.sortDir),
  });
  return parsed.success ? parsed.data : {};
}

/**
 * Staff Performance filters (§13.2 as applicable) + pagination/sort (TASK-084).
 * Metrics: created/sent, value invoiced, collections on assigned invoices — no commission.
 * Does not invent a reporting-currency rollup while ADR-011 remains OPEN.
 */
export const staffPerformanceQuerySchema = z
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
    page: optionalPositiveInt(1, 10_000),
    pageSize: optionalPositiveInt(1, STAFF_PERFORMANCE_MAX_PAGE_SIZE),
    sortBy: z.enum(STAFF_PERFORMANCE_SORT_FIELDS).optional(),
    sortDir: z.enum(STAFF_PERFORMANCE_SORT_DIRS).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.dateFrom && value.dateTo && value.dateFrom.getTime() > value.dateTo.getTime()) {
      ctx.addIssue({
        code: "custom",
        message: STAFF_PERFORMANCE_INVALID_INPUT,
        path: ["dateFrom"],
      });
    }
  });

export type StaffPerformanceQuery = z.output<typeof staffPerformanceQuerySchema>;

export type ResolvedStaffPerformanceQuery = StaffPerformanceQuery & {
  readonly page: number;
  readonly pageSize: number;
  readonly sortBy: (typeof STAFF_PERFORMANCE_SORT_FIELDS)[number];
  readonly sortDir: (typeof STAFF_PERFORMANCE_SORT_DIRS)[number];
};

export function resolveStaffPerformanceQuery(
  query: StaffPerformanceQuery,
): ResolvedStaffPerformanceQuery {
  return {
    ...query,
    page: query.page ?? 1,
    pageSize: query.pageSize ?? STAFF_PERFORMANCE_DEFAULT_PAGE_SIZE,
    sortBy: query.sortBy ?? STAFF_PERFORMANCE_DEFAULT_SORT_BY,
    sortDir: query.sortDir ?? STAFF_PERFORMANCE_DEFAULT_SORT_DIR,
  };
}

/**
 * Parse staff performance page searchParams into query input (TASK-084).
 */
export function parseStaffPerformanceSearchParams(
  params: Record<string, string | string[] | undefined>,
): StaffPerformanceQuery {
  const parsed = staffPerformanceQuerySchema.safeParse({
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
    page: firstSearchParam(params.page),
    pageSize: firstSearchParam(params.pageSize),
    sortBy: firstSearchParam(params.sortBy),
    sortDir: firstSearchParam(params.sortDir),
  });
  return parsed.success ? parsed.data : {};
}

/**
 * Gateway Report filters (§13.2 as applicable) + pagination/sort (TASK-085).
 * Rows are gateway × settlement currency with fees separate from converted settlement (BR-020).
 * Does not invent a reporting-currency rollup while ADR-011 remains OPEN.
 */
export const gatewayReportQuerySchema = z
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
    page: optionalPositiveInt(1, 10_000),
    pageSize: optionalPositiveInt(1, GATEWAY_REPORT_MAX_PAGE_SIZE),
    sortBy: z.enum(GATEWAY_REPORT_SORT_FIELDS).optional(),
    sortDir: z.enum(GATEWAY_REPORT_SORT_DIRS).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.dateFrom && value.dateTo && value.dateFrom.getTime() > value.dateTo.getTime()) {
      ctx.addIssue({
        code: "custom",
        message: GATEWAY_REPORT_INVALID_INPUT,
        path: ["dateFrom"],
      });
    }
  });

export type GatewayReportQuery = z.output<typeof gatewayReportQuerySchema>;

export type ResolvedGatewayReportQuery = GatewayReportQuery & {
  readonly page: number;
  readonly pageSize: number;
  readonly sortBy: (typeof GATEWAY_REPORT_SORT_FIELDS)[number];
  readonly sortDir: (typeof GATEWAY_REPORT_SORT_DIRS)[number];
};

export function resolveGatewayReportQuery(query: GatewayReportQuery): ResolvedGatewayReportQuery {
  return {
    ...query,
    page: query.page ?? 1,
    pageSize: query.pageSize ?? GATEWAY_REPORT_DEFAULT_PAGE_SIZE,
    sortBy: query.sortBy ?? GATEWAY_REPORT_DEFAULT_SORT_BY,
    sortDir: query.sortDir ?? GATEWAY_REPORT_DEFAULT_SORT_DIR,
  };
}

/**
 * Parse gateway report page searchParams into query input (TASK-085).
 */
export function parseGatewayReportSearchParams(
  params: Record<string, string | string[] | undefined>,
): GatewayReportQuery {
  const parsed = gatewayReportQuerySchema.safeParse({
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
    page: firstSearchParam(params.page),
    pageSize: firstSearchParam(params.pageSize),
    sortBy: firstSearchParam(params.sortBy),
    sortDir: firstSearchParam(params.sortDir),
  });
  return parsed.success ? parsed.data : {};
}

/**
 * Currency Report filters (§13.2 as applicable) (TASK-086).
 * Invoice totals by invoice currency; settlement totals by settlement currency.
 * Does not invent a reporting-currency rollup while ADR-011 remains OPEN.
 */
export const currencyReportQuerySchema = z
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
    sortBy: z.enum(CURRENCY_REPORT_SORT_FIELDS).optional(),
    sortDir: z.enum(CURRENCY_REPORT_SORT_DIRS).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.dateFrom && value.dateTo && value.dateFrom.getTime() > value.dateTo.getTime()) {
      ctx.addIssue({
        code: "custom",
        message: CURRENCY_REPORT_INVALID_INPUT,
        path: ["dateFrom"],
      });
    }
  });

export type CurrencyReportQuery = z.output<typeof currencyReportQuerySchema>;

export type ResolvedCurrencyReportQuery = CurrencyReportQuery & {
  readonly sortBy: (typeof CURRENCY_REPORT_SORT_FIELDS)[number];
  readonly sortDir: (typeof CURRENCY_REPORT_SORT_DIRS)[number];
};

export function resolveCurrencyReportQuery(
  query: CurrencyReportQuery,
): ResolvedCurrencyReportQuery {
  return {
    ...query,
    sortBy: query.sortBy ?? CURRENCY_REPORT_DEFAULT_SORT_BY,
    sortDir: query.sortDir ?? CURRENCY_REPORT_DEFAULT_SORT_DIR,
  };
}

/**
 * Parse currency report page searchParams into query input (TASK-086).
 */
export function parseCurrencyReportSearchParams(
  params: Record<string, string | string[] | undefined>,
): CurrencyReportQuery {
  const parsed = currencyReportQuerySchema.safeParse({
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
    sortBy: firstSearchParam(params.sortBy),
    sortDir: firstSearchParam(params.sortDir),
  });
  return parsed.success ? parsed.data : {};
}

/**
 * Compliance Report filters (§13.2 as applicable) (TASK-087).
 * Review counts / approved-flagged-pending / aging / notes references.
 * Staff is denied via compliance.review (not report.view alone).
 */
export const complianceReportQuerySchema = z
  .strictObject({
    companyId: optionalUuid,
    staffUserId: optionalUuid,
    reportingGroupId: optionalUuid,
    dateFrom: optionalQueueDate,
    dateTo: optionalQueueDate,
    gateway: z.enum(PAYMENT_METHOD_CODES).optional(),
    currency: optionalCurrencyCode,
    status: z.enum(COMPLIANCE_STATUSES).optional(),
    subjectType: z.enum(COMPLIANCE_REVIEW_SUBJECT_TYPES).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.dateFrom && value.dateTo && value.dateFrom.getTime() > value.dateTo.getTime()) {
      ctx.addIssue({
        code: "custom",
        message: COMPLIANCE_REPORT_INVALID_INPUT,
        path: ["dateFrom"],
      });
    }
  });

export type ComplianceReportQuery = z.output<typeof complianceReportQuerySchema>;

/**
 * Parse compliance report page searchParams into query input (TASK-087).
 */
export function parseComplianceReportSearchParams(
  params: Record<string, string | string[] | undefined>,
): ComplianceReportQuery {
  const parsed = complianceReportQuerySchema.safeParse({
    companyId: firstSearchParam(params.companyId),
    staffUserId: firstSearchParam(params.staffUserId),
    reportingGroupId: firstSearchParam(params.reportingGroupId),
    dateFrom: firstSearchParam(params.dateFrom),
    dateTo: firstSearchParam(params.dateTo),
    gateway: firstSearchParam(params.gateway),
    currency: firstSearchParam(params.currency),
    status: firstSearchParam(params.status),
    subjectType: firstSearchParam(params.subjectType),
  });
  return parsed.success ? parsed.data : {};
}

/**
 * Monthly Brand / CB-RF Matrix filters (§13.2 as applicable) (TASK-088).
 * Default basis: payment received/effective date within the selected reporting year.
 * Amounts convert to the configured system reporting currency using stored snapshots.
 */
export const monthlyBrandMatrixQuerySchema = z
  .strictObject({
    year: z.preprocess(
      emptyToUndefined,
      z.coerce
        .number()
        .int()
        .min(MONTHLY_BRAND_MATRIX_MIN_YEAR)
        .max(MONTHLY_BRAND_MATRIX_MAX_YEAR)
        .optional(),
    ),
    companyId: optionalUuid,
    customerId: optionalUuid,
    staffUserId: optionalUuid,
    reportingGroupId: optionalUuid,
    paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
    paymentMethod: z.enum(PAYMENT_METHOD_CODES).optional(),
    invoiceCurrency: optionalCurrencyCode,
    settlementCurrency: optionalCurrencyCode,
    countryCode: optionalCountryCode,
    complianceStatus: z.enum(COMPLIANCE_STATUSES).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.year != null && !Number.isFinite(value.year)) {
      ctx.addIssue({
        code: "custom",
        message: MONTHLY_BRAND_MATRIX_INVALID_INPUT,
        path: ["year"],
      });
    }
  });

export type MonthlyBrandMatrixQuery = z.output<typeof monthlyBrandMatrixQuerySchema>;

export type ResolvedMonthlyBrandMatrixQuery = MonthlyBrandMatrixQuery & {
  readonly year: number;
};

export function resolveMonthlyBrandMatrixQuery(
  query: MonthlyBrandMatrixQuery,
  now: Date = new Date(),
): ResolvedMonthlyBrandMatrixQuery {
  return {
    ...query,
    year: query.year ?? now.getUTCFullYear(),
  };
}

/**
 * Parse monthly brand matrix page searchParams into query input (TASK-088).
 */
export function parseMonthlyBrandMatrixSearchParams(
  params: Record<string, string | string[] | undefined>,
): MonthlyBrandMatrixQuery {
  const parsed = monthlyBrandMatrixQuerySchema.safeParse({
    year: firstSearchParam(params.year),
    companyId: firstSearchParam(params.companyId),
    customerId: firstSearchParam(params.customerId),
    staffUserId: firstSearchParam(params.staffUserId),
    reportingGroupId: firstSearchParam(params.reportingGroupId),
    paymentStatus: firstSearchParam(params.paymentStatus),
    paymentMethod: firstSearchParam(params.paymentMethod),
    invoiceCurrency: firstSearchParam(params.invoiceCurrency),
    settlementCurrency: firstSearchParam(params.settlementCurrency),
    countryCode: firstSearchParam(params.countryCode),
    complianceStatus: firstSearchParam(params.complianceStatus),
  });
  return parsed.success ? parsed.data : {};
}

/**
 * Reporting Group Rollup filters (§13.2 as applicable) + reporting year (TASK-089).
 * KPIs roll up by reporting group; matrix summary uses payment received/effective dates.
 * Reporting group narrows scope only — never transaction ownership.
 */
export const reportingGroupRollupQuerySchema = z
  .strictObject({
    year: z.preprocess(
      emptyToUndefined,
      z.coerce
        .number()
        .int()
        .min(MONTHLY_BRAND_MATRIX_MIN_YEAR)
        .max(MONTHLY_BRAND_MATRIX_MAX_YEAR)
        .optional(),
    ),
    reportingGroupId: optionalUuid,
    companyId: optionalUuid,
    customerId: optionalUuid,
    staffUserId: optionalUuid,
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
        message: REPORTING_GROUP_ROLLUP_INVALID_INPUT,
        path: ["dateFrom"],
      });
    }
    if (value.year != null && !Number.isFinite(value.year)) {
      ctx.addIssue({
        code: "custom",
        message: REPORTING_GROUP_ROLLUP_INVALID_INPUT,
        path: ["year"],
      });
    }
  });

export type ReportingGroupRollupQuery = z.output<typeof reportingGroupRollupQuerySchema>;

export type ResolvedReportingGroupRollupQuery = ReportingGroupRollupQuery & {
  readonly year: number;
};

export function resolveReportingGroupRollupQuery(
  query: ReportingGroupRollupQuery,
  now: Date = new Date(),
): ResolvedReportingGroupRollupQuery {
  return {
    ...query,
    year: query.year ?? now.getUTCFullYear(),
  };
}

/**
 * Parse reporting group rollup page searchParams into query input (TASK-089).
 */
export function parseReportingGroupRollupSearchParams(
  params: Record<string, string | string[] | undefined>,
): ReportingGroupRollupQuery {
  const parsed = reportingGroupRollupQuerySchema.safeParse({
    year: firstSearchParam(params.year),
    reportingGroupId: firstSearchParam(params.reportingGroupId),
    companyId: firstSearchParam(params.companyId),
    customerId: firstSearchParam(params.customerId),
    staffUserId: firstSearchParam(params.staffUserId),
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
