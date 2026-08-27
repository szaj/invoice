import type { ComplianceStatus } from "@/domain/compliance/types";
import type { InvoiceStatus } from "@/domain/invoices/types";
import type { PaymentMethodCode } from "@/domain/settlement/types";
import type { PaymentRateSource, PaymentStatus } from "@/domain/payments/types";

/**
 * Dashboard KPI payload (Dashboard and Reporting §13.1 / TASK-077).
 * Amounts are Decimal strings — never JS number. Never one unlabeled mixed-currency total (BR-013).
 * Merchant fees are reconciliation-only and never deducted from converted settlement (BR-020).
 */

export type DashboardCurrencyAmountBucket = {
  readonly currencyCode: string;
  readonly amount: string;
};

export type DashboardInvoiceCurrencyKpis = {
  readonly currencyCode: string;
  readonly totalInvoiced: string;
  readonly totalPaid: string;
  readonly outstanding: string;
  readonly overdue: string;
};

export type DashboardSettlementCurrencyKpis = {
  readonly currencyCode: string;
  /** Confirmed settlement equivalent from stored Admin fixed-rate snapshots. */
  readonly convertedSettlement: string;
  /** Optional confirmed fee totals; displayed separately (BR-020). */
  readonly processorFees: string;
  /** Optional confirmed/recorded received amounts; never auto-derived from fee. */
  readonly actualReceived: string;
};

export type DashboardStatusCount = {
  readonly status: string;
  readonly count: number;
};

export type DashboardMethodStatusCount = {
  readonly methodCode: PaymentMethodCode;
  readonly status: PaymentStatus;
  readonly count: number;
};

export type DashboardKpiPayload = {
  readonly invoiceCurrencies: readonly DashboardInvoiceCurrencyKpis[];
  readonly settlementCurrencies: readonly DashboardSettlementCurrencyKpis[];
  readonly invoiceCountsByStatus: readonly DashboardStatusCount[];
  readonly paymentCountsByMethodStatus: readonly DashboardMethodStatusCount[];
};

export type DashboardInvoiceRow = {
  readonly id: string;
  readonly companyId: string;
  readonly customerId: string;
  readonly currencyCode: string;
  readonly status: InvoiceStatus;
  readonly complianceStatus: ComplianceStatus;
  readonly invoiceTotal: string;
  readonly confirmedPaidAmount: string;
  readonly outstandingAmount: string;
  readonly dueDate: Date;
  readonly invoiceDate: Date;
  readonly assignedStaffUserId: string | null;
  readonly createdByUserId: string | null;
  readonly decimalPrecision: number;
};

export type DashboardPaymentRow = {
  readonly id: string;
  readonly companyId: string;
  readonly invoiceId: string;
  readonly customerId: string;
  readonly methodCode: PaymentMethodCode;
  readonly status: PaymentStatus;
  readonly complianceStatus: ComplianceStatus;
  readonly invoiceCurrencyCode: string;
  readonly invoiceAmountApplied: string;
  readonly settlementCurrencyCode: string;
  readonly convertedSettlementAmount: string;
  readonly processorFeeAmount: string | null;
  readonly actualReceivedAmount: string | null;
  readonly paymentDate: Date;
  readonly invoiceCreatedByUserId: string | null;
  readonly invoiceAssignedStaffUserId: string | null;
  readonly invoiceDecimalPrecision: number;
  readonly settlementDecimalPrecision: number;
};

export const DASHBOARD_INVALID_INPUT = "Check the dashboard filters and try again.";
export const DASHBOARD_FORBIDDEN = "You do not have permission to view the dashboard.";
export const DASHBOARD_UNAVAILABLE = "Dashboard is temporarily unavailable.";

/**
 * Invoice Report (§13.3 / TASK-078).
 * Row amounts stay in original invoice currency — never one unlabeled mixed-currency total (BR-013).
 */
export const INVOICE_REPORT_SORT_FIELDS = [
  "invoiceNumber",
  "customer",
  "company",
  "invoiceDate",
  "dueDate",
  "currency",
  "total",
  "paid",
  "balance",
  "status",
  "staff",
] as const;

export type InvoiceReportSortField = (typeof INVOICE_REPORT_SORT_FIELDS)[number];

export const INVOICE_REPORT_SORT_DIRS = ["asc", "desc"] as const;
export type InvoiceReportSortDir = (typeof INVOICE_REPORT_SORT_DIRS)[number];

export const INVOICE_REPORT_DEFAULT_PAGE_SIZE = 50;
export const INVOICE_REPORT_MAX_PAGE_SIZE = 100;
export const INVOICE_REPORT_DEFAULT_SORT_BY: InvoiceReportSortField = "invoiceDate";
export const INVOICE_REPORT_DEFAULT_SORT_DIR: InvoiceReportSortDir = "desc";

export type InvoiceReportRow = {
  readonly id: string;
  readonly invoiceNumber: string | null;
  readonly customerId: string;
  readonly customerDisplayName: string;
  readonly companyId: string;
  readonly companyDisplayName: string;
  readonly invoiceDate: string;
  readonly dueDate: string;
  readonly currencyCode: string;
  readonly invoiceTotal: string;
  readonly confirmedPaidAmount: string;
  readonly outstandingAmount: string;
  readonly status: InvoiceStatus;
  readonly assignedStaffUserId: string | null;
  readonly assignedStaffName: string | null;
  readonly decimalPrecision: number;
};

export type InvoiceReportPayload = {
  readonly rows: readonly InvoiceReportRow[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly sortBy: InvoiceReportSortField;
  readonly sortDir: InvoiceReportSortDir;
};

export const INVOICE_REPORT_INVALID_INPUT = "Check the invoice report filters and try again.";
export const INVOICE_REPORT_FORBIDDEN = "You do not have permission to view the invoice report.";
export const INVOICE_REPORT_UNAVAILABLE = "Invoice report is temporarily unavailable.";

/**
 * Payment Report (§13.3 / TASK-079).
 * Uses stored fixed-rate snapshots and converted settlement only — never live FX (BR-020/021).
 * Optional processor fee and actual received are reconciliation-only (BR-020).
 * Does not invent a reporting-currency rollup while ADR-011 remains OPEN.
 */
export const PAYMENT_REPORT_SORT_FIELDS = [
  "invoice",
  "customer",
  "method",
  "transactionId",
  "applied",
  "rate",
  "settlement",
  "fee",
  "actualReceived",
  "currency",
  "date",
  "status",
] as const;

export type PaymentReportSortField = (typeof PAYMENT_REPORT_SORT_FIELDS)[number];

export const PAYMENT_REPORT_SORT_DIRS = ["asc", "desc"] as const;
export type PaymentReportSortDir = (typeof PAYMENT_REPORT_SORT_DIRS)[number];

export const PAYMENT_REPORT_DEFAULT_PAGE_SIZE = 50;
export const PAYMENT_REPORT_MAX_PAGE_SIZE = 100;
export const PAYMENT_REPORT_DEFAULT_SORT_BY: PaymentReportSortField = "date";
export const PAYMENT_REPORT_DEFAULT_SORT_DIR: PaymentReportSortDir = "desc";

export type PaymentReportRow = {
  readonly id: string;
  readonly invoiceId: string;
  readonly invoiceNumber: string | null;
  readonly customerId: string;
  readonly customerDisplayName: string;
  readonly methodCode: PaymentMethodCode;
  readonly externalTransactionId: string | null;
  readonly invoiceCurrencyCode: string;
  readonly invoiceAmountApplied: string;
  /** Locked Admin fixed-rate snapshot (or 1 for same-currency). Never live FX. */
  readonly fixedConversionRate: string;
  readonly rateSource: PaymentRateSource;
  readonly settlementCurrencyCode: string;
  /** Stored converted settlement — fee excluded (BR-020). */
  readonly convertedSettlementAmount: string;
  /** Optional reconciliation fee; never deducted from settlement. */
  readonly processorFeeAmount: string | null;
  /** Optional recorded received amount; never auto-derived. */
  readonly actualReceivedAmount: string | null;
  readonly paymentDate: string;
  readonly status: PaymentStatus;
  readonly invoiceDecimalPrecision: number;
  readonly settlementDecimalPrecision: number;
};

export type PaymentReportPayload = {
  readonly rows: readonly PaymentReportRow[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly sortBy: PaymentReportSortField;
  readonly sortDir: PaymentReportSortDir;
};

export const PAYMENT_REPORT_INVALID_INPUT = "Check the payment report filters and try again.";
export const PAYMENT_REPORT_FORBIDDEN = "You do not have permission to view the payment report.";
export const PAYMENT_REPORT_UNAVAILABLE = "Payment report is temporarily unavailable.";

/**
 * Outstanding Report (§13.3 / TASK-080).
 * Open invoice balances only — cancelled excluded by default (BR-019).
 * Outstanding is the stored confirmed-application balance (BR-009).
 * Amounts stay in original invoice currency — never one unlabeled mixed total (BR-013).
 */
export const OUTSTANDING_REPORT_SORT_FIELDS = [
  "invoiceNumber",
  "customer",
  "dueDate",
  "age",
  "currency",
  "outstanding",
  "company",
  "staff",
] as const;

export type OutstandingReportSortField = (typeof OUTSTANDING_REPORT_SORT_FIELDS)[number];

export const OUTSTANDING_REPORT_SORT_DIRS = ["asc", "desc"] as const;
export type OutstandingReportSortDir = (typeof OUTSTANDING_REPORT_SORT_DIRS)[number];

export const OUTSTANDING_REPORT_DEFAULT_PAGE_SIZE = 50;
export const OUTSTANDING_REPORT_MAX_PAGE_SIZE = 100;
export const OUTSTANDING_REPORT_DEFAULT_SORT_BY: OutstandingReportSortField = "dueDate";
export const OUTSTANDING_REPORT_DEFAULT_SORT_DIR: OutstandingReportSortDir = "asc";

export type OutstandingReportRow = {
  readonly id: string;
  readonly invoiceNumber: string | null;
  readonly customerId: string;
  readonly customerDisplayName: string;
  readonly companyId: string;
  readonly companyDisplayName: string;
  readonly dueDate: string;
  /** Days past due (UTC); 0 when not yet due. */
  readonly ageDays: number;
  readonly currencyCode: string;
  /** Stored confirmed-application outstanding (BR-009). */
  readonly outstandingAmount: string;
  readonly status: InvoiceStatus;
  readonly assignedStaffUserId: string | null;
  readonly assignedStaffName: string | null;
  readonly decimalPrecision: number;
};

export type OutstandingReportPayload = {
  readonly rows: readonly OutstandingReportRow[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly sortBy: OutstandingReportSortField;
  readonly sortDir: OutstandingReportSortDir;
};

export const OUTSTANDING_REPORT_INVALID_INPUT =
  "Check the outstanding report filters and try again.";
export const OUTSTANDING_REPORT_FORBIDDEN =
  "You do not have permission to view the outstanding report.";
export const OUTSTANDING_REPORT_UNAVAILABLE = "Outstanding report is temporarily unavailable.";

/**
 * Overdue Aging Report (TASK-081 / §13.3 / BR-018).
 * Buckets 1-30, 31-60, 61-90, 90+ days past due.
 */
export const OVERDUE_AGING_BUCKET_IDS = ["1-30", "31-60", "61-90", "90+"] as const;
export type OverdueAgingBucketId = (typeof OVERDUE_AGING_BUCKET_IDS)[number];

export type OverdueAgingSourceInvoice = {
  readonly status: InvoiceStatus;
  readonly dueDate: Date;
  readonly outstandingAmount: string;
  readonly currencyCode: string;
  readonly decimalPrecision: number;
};

export type OverdueAgingCurrencyTotal = {
  readonly currencyCode: string;
  /** Stored confirmed-application outstanding (BR-009). */
  readonly outstandingAmount: string;
  readonly invoiceCount: number;
  readonly decimalPrecision: number;
};

export type OverdueAgingBucketSummary = {
  readonly bucket: OverdueAgingBucketId;
  readonly label: string;
  readonly currencies: readonly OverdueAgingCurrencyTotal[];
  readonly invoiceCount: number;
};

export type OverdueAgingPayload = {
  /** UTC date-only (YYYY-MM-DD) used for age evaluation. */
  readonly asOf: string;
  readonly buckets: readonly OverdueAgingBucketSummary[];
};

export const OVERDUE_AGING_INVALID_INPUT = "Check the overdue aging report filters and try again.";
export const OVERDUE_AGING_FORBIDDEN =
  "You do not have permission to view the overdue aging report.";
export const OVERDUE_AGING_UNAVAILABLE = "Overdue aging report is temporarily unavailable.";

/**
 * Customer Report (§13.3 / TASK-082).
 * Total invoiced / paid / outstanding by customer and invoice currency.
 * Never one unlabeled mixed-currency total (BR-013). ADR-011 rollup not invented.
 */
export const CUSTOMER_REPORT_SORT_FIELDS = [
  "customer",
  "currency",
  "invoiced",
  "paid",
  "outstanding",
  "invoiceCount",
] as const;

export type CustomerReportSortField = (typeof CUSTOMER_REPORT_SORT_FIELDS)[number];

export const CUSTOMER_REPORT_SORT_DIRS = ["asc", "desc"] as const;
export type CustomerReportSortDir = (typeof CUSTOMER_REPORT_SORT_DIRS)[number];

export const CUSTOMER_REPORT_DEFAULT_PAGE_SIZE = 50;
export const CUSTOMER_REPORT_MAX_PAGE_SIZE = 100;
export const CUSTOMER_REPORT_DEFAULT_SORT_BY: CustomerReportSortField = "customer";
export const CUSTOMER_REPORT_DEFAULT_SORT_DIR: CustomerReportSortDir = "asc";

export type CustomerReportSourceInvoice = {
  readonly customerId: string;
  readonly customerDisplayName: string;
  readonly currencyCode: string;
  readonly status: InvoiceStatus;
  readonly invoiceTotal: string;
  readonly confirmedPaidAmount: string;
  readonly outstandingAmount: string;
  readonly decimalPrecision: number;
};

export type CustomerReportRow = {
  readonly customerId: string;
  readonly customerDisplayName: string;
  readonly currencyCode: string;
  /** Sum of collectible invoice totals in this currency. */
  readonly totalInvoiced: string;
  /** Sum of stored confirmed paid amounts in this currency (BR-009). */
  readonly totalPaid: string;
  /** Sum of stored outstanding balances in this currency (BR-009). */
  readonly outstanding: string;
  readonly invoiceCount: number;
  readonly decimalPrecision: number;
};

export type CustomerReportPayload = {
  readonly rows: readonly CustomerReportRow[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly sortBy: CustomerReportSortField;
  readonly sortDir: CustomerReportSortDir;
};

export const CUSTOMER_REPORT_INVALID_INPUT = "Check the customer report filters and try again.";
export const CUSTOMER_REPORT_FORBIDDEN = "You do not have permission to view the customer report.";
export const CUSTOMER_REPORT_UNAVAILABLE = "Customer report is temporarily unavailable.";
