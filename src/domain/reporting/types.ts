import type { ComplianceReviewSubjectType, ComplianceStatus } from "@/domain/compliance/types";
import type { InvoiceStatus } from "@/domain/invoices/types";
import type { PaymentAdjustmentStatus, PaymentAdjustmentType } from "@/domain/payments/adjustments";
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

/**
 * Company Performance (§13.3 / TASK-083).
 * Invoice and settlement KPIs by owning company (never by reporting group as owner).
 * Currency buckets stay separate — no unlabeled mixed total (BR-013). ADR-011 rollup not invented.
 */
export const COMPANY_PERFORMANCE_SORT_FIELDS = ["company", "invoiceCount", "paymentCount"] as const;

export type CompanyPerformanceSortField = (typeof COMPANY_PERFORMANCE_SORT_FIELDS)[number];

export const COMPANY_PERFORMANCE_SORT_DIRS = ["asc", "desc"] as const;
export type CompanyPerformanceSortDir = (typeof COMPANY_PERFORMANCE_SORT_DIRS)[number];

export const COMPANY_PERFORMANCE_DEFAULT_PAGE_SIZE = 50;
export const COMPANY_PERFORMANCE_MAX_PAGE_SIZE = 100;
export const COMPANY_PERFORMANCE_DEFAULT_SORT_BY: CompanyPerformanceSortField = "company";
export const COMPANY_PERFORMANCE_DEFAULT_SORT_DIR: CompanyPerformanceSortDir = "asc";

export type CompanyPerformanceSourceInvoice = DashboardInvoiceRow & {
  readonly companyDisplayName: string;
};

export type CompanyPerformanceSourcePayment = DashboardPaymentRow & {
  readonly companyDisplayName: string;
};

export type CompanyPerformanceRow = {
  readonly companyId: string;
  readonly companyDisplayName: string;
  /** Invoice-currency KPI buckets for this owning company. */
  readonly invoiceCurrencies: readonly DashboardInvoiceCurrencyKpis[];
  /** Settlement-currency KPI buckets from stored payment snapshots (BR-020). */
  readonly settlementCurrencies: readonly DashboardSettlementCurrencyKpis[];
  readonly invoiceCount: number;
  readonly paymentCount: number;
};

export type CompanyPerformancePayload = {
  readonly rows: readonly CompanyPerformanceRow[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly sortBy: CompanyPerformanceSortField;
  readonly sortDir: CompanyPerformanceSortDir;
};

export const COMPANY_PERFORMANCE_INVALID_INPUT =
  "Check the company performance filters and try again.";
export const COMPANY_PERFORMANCE_FORBIDDEN =
  "You do not have permission to view the company performance report.";
export const COMPANY_PERFORMANCE_UNAVAILABLE =
  "Company performance report is temporarily unavailable.";

/**
 * Staff Performance (§13.3 / TASK-084).
 * Invoices created/sent, value invoiced, collections linked to assigned invoices.
 * Does not invent staff commission.
 * Currency buckets stay separate — no unlabeled mixed total (BR-013). ADR-011 rollup not invented.
 */
export const STAFF_PERFORMANCE_SORT_FIELDS = [
  "staff",
  "invoicesCreated",
  "invoicesSent",
  "collectionsCount",
] as const;

export type StaffPerformanceSortField = (typeof STAFF_PERFORMANCE_SORT_FIELDS)[number];

export const STAFF_PERFORMANCE_SORT_DIRS = ["asc", "desc"] as const;
export type StaffPerformanceSortDir = (typeof STAFF_PERFORMANCE_SORT_DIRS)[number];

export const STAFF_PERFORMANCE_DEFAULT_PAGE_SIZE = 50;
export const STAFF_PERFORMANCE_MAX_PAGE_SIZE = 100;
export const STAFF_PERFORMANCE_DEFAULT_SORT_BY: StaffPerformanceSortField = "staff";
export const STAFF_PERFORMANCE_DEFAULT_SORT_DIR: StaffPerformanceSortDir = "asc";

export type StaffPerformanceSourceInvoice = {
  readonly id: string;
  readonly companyId: string;
  readonly customerId: string;
  readonly currencyCode: string;
  readonly status: InvoiceStatus;
  readonly complianceStatus: ComplianceStatus;
  readonly invoiceNumber: string | null;
  readonly invoiceTotal: string;
  readonly confirmedPaidAmount: string;
  readonly outstandingAmount: string;
  readonly invoiceDate: Date;
  readonly assignedStaffUserId: string | null;
  readonly assignedStaffName: string | null;
  readonly createdByUserId: string | null;
  readonly createdByName: string | null;
  readonly decimalPrecision: number;
};

export type StaffPerformanceSourcePayment = {
  readonly id: string;
  readonly companyId: string;
  readonly invoiceId: string;
  readonly customerId: string;
  readonly status: PaymentStatus;
  readonly invoiceCurrencyCode: string;
  readonly invoiceAmountApplied: string;
  readonly paymentDate: Date;
  readonly invoiceAssignedStaffUserId: string | null;
  readonly invoiceAssignedStaffName: string | null;
  readonly invoiceDecimalPrecision: number;
};

export type StaffPerformanceCurrencyAmount = {
  readonly currencyCode: string;
  readonly amount: string;
};

export type StaffPerformanceRow = {
  readonly staffUserId: string;
  readonly staffDisplayName: string;
  /** Invoices created by this staff user (all statuses). */
  readonly invoicesCreated: number;
  /** Invoices created by this staff that were issued/sent (invoice number assigned). */
  readonly invoicesSent: number;
  /** Collectible invoice totals attributed to creator, by invoice currency. */
  readonly valueInvoiced: readonly StaffPerformanceCurrencyAmount[];
  /** Confirmed payment applications on invoices assigned to this staff, by invoice currency. */
  readonly collections: readonly StaffPerformanceCurrencyAmount[];
  readonly collectionsCount: number;
};

export type StaffPerformancePayload = {
  readonly rows: readonly StaffPerformanceRow[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly sortBy: StaffPerformanceSortField;
  readonly sortDir: StaffPerformanceSortDir;
};

export const STAFF_PERFORMANCE_INVALID_INPUT = "Check the staff performance filters and try again.";
export const STAFF_PERFORMANCE_FORBIDDEN =
  "You do not have permission to view the staff performance report.";
export const STAFF_PERFORMANCE_UNAVAILABLE = "Staff performance report is temporarily unavailable.";

/**
 * Gateway Report (§13.3 / TASK-085).
 * Transactions, converted settlement, optional fees/actual received, failures, and refunds
 * by gateway (method) × settlement currency. Fees never deducted from settlement (BR-020).
 * Currency buckets stay separate — no unlabeled mixed total (BR-013). ADR-011 rollup not invented.
 */
export const GATEWAY_REPORT_SORT_FIELDS = [
  "gateway",
  "settlementCurrency",
  "transactionCount",
  "failureCount",
  "convertedSettlement",
  "refunds",
] as const;

export type GatewayReportSortField = (typeof GATEWAY_REPORT_SORT_FIELDS)[number];

export const GATEWAY_REPORT_SORT_DIRS = ["asc", "desc"] as const;
export type GatewayReportSortDir = (typeof GATEWAY_REPORT_SORT_DIRS)[number];

export const GATEWAY_REPORT_DEFAULT_PAGE_SIZE = 50;
export const GATEWAY_REPORT_MAX_PAGE_SIZE = 100;
export const GATEWAY_REPORT_DEFAULT_SORT_BY: GatewayReportSortField = "gateway";
export const GATEWAY_REPORT_DEFAULT_SORT_DIR: GatewayReportSortDir = "asc";

export type GatewayReportSourcePayment = {
  readonly id: string;
  readonly companyId: string;
  readonly invoiceId: string;
  readonly customerId: string;
  readonly methodCode: PaymentMethodCode;
  readonly status: PaymentStatus;
  readonly complianceStatus: ComplianceStatus;
  readonly invoiceCurrencyCode: string;
  readonly settlementCurrencyCode: string;
  readonly convertedSettlementAmount: string;
  readonly processorFeeAmount: string | null;
  readonly actualReceivedAmount: string | null;
  readonly paymentDate: Date;
  readonly invoiceCreatedByUserId: string | null;
  readonly invoiceAssignedStaffUserId: string | null;
  readonly settlementDecimalPrecision: number;
};

/** PROCESSED REFUND adjustment attributed via parent payment gateway + settlement currency. */
export type GatewayReportSourceRefund = {
  readonly id: string;
  readonly companyId: string;
  readonly paymentId: string;
  readonly methodCode: PaymentMethodCode;
  readonly settlementCurrencyCode: string;
  /** Settlement-currency refund amount (settlementAmount ?? amount). */
  readonly refundAmount: string;
  readonly effectiveDate: Date;
  readonly settlementDecimalPrecision: number;
};

export type GatewayReportRow = {
  readonly methodCode: PaymentMethodCode;
  readonly settlementCurrencyCode: string;
  /** SUCCESSFUL payment count for this gateway × settlement currency. */
  readonly transactionCount: number;
  /** FAILED payment count for this gateway × settlement currency. */
  readonly failureCount: number;
  /** Sum of stored converted settlement for SUCCESSFUL payments (fee excluded — BR-020). */
  readonly convertedSettlement: string;
  /** Optional processor/merchant fee total; reconciliation only (BR-020). */
  readonly processorFees: string;
  /** Optional actual received total; never auto-derived from fee. */
  readonly actualReceived: string;
  /** PROCESSED REFUND count. */
  readonly refundCount: number;
  /** Sum of PROCESSED REFUND settlement amounts. */
  readonly refunds: string;
  readonly settlementDecimalPrecision: number;
};

export type GatewayReportPayload = {
  readonly rows: readonly GatewayReportRow[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly sortBy: GatewayReportSortField;
  readonly sortDir: GatewayReportSortDir;
};

export const GATEWAY_REPORT_INVALID_INPUT = "Check the gateway report filters and try again.";
export const GATEWAY_REPORT_FORBIDDEN = "You do not have permission to view the gateway report.";
export const GATEWAY_REPORT_UNAVAILABLE = "Gateway report is temporarily unavailable.";

/**
 * Currency Report (§13.3 / TASK-086).
 * Invoice totals by invoice currency and settlement totals by settlement currency.
 * Each currency stays labeled — never collapse into an unlabeled mixed total (BR-013).
 * Settlement uses stored payment snapshots; fees stay separate (BR-020). ADR-011 rollup not invented.
 */
export const CURRENCY_REPORT_SORT_FIELDS = ["currency"] as const;

export type CurrencyReportSortField = (typeof CURRENCY_REPORT_SORT_FIELDS)[number];

export const CURRENCY_REPORT_SORT_DIRS = ["asc", "desc"] as const;
export type CurrencyReportSortDir = (typeof CURRENCY_REPORT_SORT_DIRS)[number];

export const CURRENCY_REPORT_DEFAULT_SORT_BY: CurrencyReportSortField = "currency";
export const CURRENCY_REPORT_DEFAULT_SORT_DIR: CurrencyReportSortDir = "asc";

export type CurrencyReportSourceInvoice = DashboardInvoiceRow;
export type CurrencyReportSourcePayment = DashboardPaymentRow;

export type CurrencyReportInvoiceRow = DashboardInvoiceCurrencyKpis;
export type CurrencyReportSettlementRow = DashboardSettlementCurrencyKpis;

export type CurrencyReportPayload = {
  /** Invoice totals keyed by invoice currency code (BR-013). */
  readonly invoiceCurrencies: readonly CurrencyReportInvoiceRow[];
  /** Settlement totals keyed by settlement currency code from stored snapshots (BR-020). */
  readonly settlementCurrencies: readonly CurrencyReportSettlementRow[];
  readonly sortBy: CurrencyReportSortField;
  readonly sortDir: CurrencyReportSortDir;
};

export const CURRENCY_REPORT_INVALID_INPUT = "Check the currency report filters and try again.";
export const CURRENCY_REPORT_FORBIDDEN = "You do not have permission to view the currency report.";
export const CURRENCY_REPORT_UNAVAILABLE = "Currency report is temporarily unavailable.";

/**
 * Compliance Report (§13.3 / TASK-087).
 * Review counts, approved/flagged/pending, aging, and notes references.
 * Admin/Compliance only — Staff denied by default (requires compliance.review).
 * Read-only; does not manipulate audit logs.
 */
export const COMPLIANCE_REPORT_AGING_BUCKET_IDS = ["0-30", "31-60", "61-90", "90+"] as const;
export type ComplianceReportAgingBucketId = (typeof COMPLIANCE_REPORT_AGING_BUCKET_IDS)[number];

export const COMPLIANCE_REPORT_NOTE_REFERENCE_LIMIT = 100;

export type ComplianceReportSourceSubject = {
  readonly subjectType: ComplianceReviewSubjectType;
  readonly subjectId: string;
  readonly companyId: string;
  readonly complianceStatus: ComplianceStatus;
  readonly date: Date | null;
  readonly label: string | null;
};

export type ComplianceReportSourceNote = {
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
  readonly label: string | null;
};

export type ComplianceReportStatusCounts = {
  readonly notReviewed: number;
  readonly underReview: number;
  readonly approved: number;
  readonly flagged: number;
  /** Pending = not reviewed + under review. */
  readonly pending: number;
  readonly total: number;
};

export type ComplianceReportSubjectTypeCounts = {
  readonly subjectType: ComplianceReviewSubjectType;
  readonly notReviewed: number;
  readonly underReview: number;
  readonly approved: number;
  readonly flagged: number;
  readonly pending: number;
  readonly total: number;
};

export type ComplianceReportAgingBucket = {
  readonly bucket: ComplianceReportAgingBucketId;
  readonly label: string;
  readonly pendingCount: number;
  readonly flaggedCount: number;
  readonly totalCount: number;
};

export type ComplianceReportNoteReference = {
  readonly reviewId: string;
  readonly subjectType: ComplianceReviewSubjectType;
  readonly subjectId: string;
  readonly companyId: string;
  readonly status: ComplianceStatus;
  readonly hasNotes: boolean;
  readonly hasReason: boolean;
  readonly hasResolutionNotes: boolean;
  readonly evidenceRefCount: number;
  readonly reviewerUserId: string | null;
  readonly createdAt: string;
  readonly label: string | null;
};

export type ComplianceReportPayload = {
  readonly statusCounts: ComplianceReportStatusCounts;
  readonly bySubjectType: readonly ComplianceReportSubjectTypeCounts[];
  readonly aging: readonly ComplianceReportAgingBucket[];
  readonly noteReferences: readonly ComplianceReportNoteReference[];
  readonly noteReferenceTotal: number;
};

export const COMPLIANCE_REPORT_INVALID_INPUT = "Check the compliance report filters and try again.";
export const COMPLIANCE_REPORT_FORBIDDEN =
  "You do not have permission to view the compliance report.";
export const COMPLIANCE_REPORT_UNAVAILABLE = "Compliance report is temporarily unavailable.";

/**
 * Monthly Brand / CB-RF Matrix (§13.3.1 / TASK-088).
 * Spreadsheet-style Jan–Dec rows with brand columns, Monthly Total, CB/RF, and G.Total.
 * Amounts are converted to the configured reporting currency using stored snapshots (BR-013 / BR-024 / BR-026).
 */
export const MONTHLY_BRAND_MATRIX_MIN_YEAR = 2000;
export const MONTHLY_BRAND_MATRIX_MAX_YEAR = 2100;

export type MonthlyBrandMatrixRowKey =
  | "month-1"
  | "month-2"
  | "month-3"
  | "month-4"
  | "month-5"
  | "month-6"
  | "month-7"
  | "month-8"
  | "month-9"
  | "month-10"
  | "month-11"
  | "month-12"
  | "g-total";

export type MonthlyBrandMatrixDrillDown = {
  readonly paymentIds: readonly string[];
  readonly adjustmentIds: readonly string[];
};

export type MonthlyBrandMatrixCompanyCell = {
  readonly companyId: string;
  readonly grossReceipts: string;
  readonly drillDown: MonthlyBrandMatrixDrillDown;
};

export type MonthlyBrandMatrixRow = {
  readonly rowKey: MonthlyBrandMatrixRowKey;
  /** 1–12 for month rows; null for G.Total. */
  readonly month: number | null;
  readonly label: string;
  readonly companies: readonly MonthlyBrandMatrixCompanyCell[];
  readonly monthlyTotal: string;
  readonly cbrf: string;
  readonly netGTotal: string;
  readonly drillDown: MonthlyBrandMatrixDrillDown;
};

export type MonthlyBrandMatrixCompanyColumn = {
  readonly companyId: string;
  readonly companyDisplayName: string;
  readonly annualGross: string;
  readonly drillDown: MonthlyBrandMatrixDrillDown;
};

export type MonthlyBrandMatrixSummary = {
  readonly currentMonth: number | null;
  readonly currentMonthLabel: string | null;
  readonly currentMonthGross: string;
  readonly currentMonthCbrf: string;
  readonly currentMonthNet: string;
  readonly annualGross: string;
  readonly annualCbrf: string;
  readonly annualNetGTotal: string;
  /** Open disputes reported separately — never deducted (BR-024). */
  readonly openDisputes: string;
};

export type MonthlyBrandMatrixPayload = {
  readonly year: number;
  readonly reportingCurrencyCode: string;
  readonly reportingCurrencyLabel: string;
  readonly decimalPrecision: number;
  readonly dateBasis: "payment_received_effective";
  readonly companies: readonly MonthlyBrandMatrixCompanyColumn[];
  readonly rows: readonly MonthlyBrandMatrixRow[];
  readonly summary: MonthlyBrandMatrixSummary;
  readonly skippedConversionCount: number;
};

export type MonthlyBrandMatrixSourceCompany = {
  readonly id: string;
  readonly displayName: string;
};

export type MonthlyBrandMatrixSourcePayment = {
  readonly id: string;
  readonly companyId: string;
  readonly status: PaymentStatus;
  readonly settlementCurrencyCode: string;
  readonly convertedSettlementAmount: string;
  readonly paymentDate: Date;
  readonly settlementDecimalPrecision: number;
};

export type MonthlyBrandMatrixSourceAdjustment = {
  readonly id: string;
  readonly companyId: string;
  readonly paymentId: string;
  readonly type: PaymentAdjustmentType;
  readonly status: PaymentAdjustmentStatus;
  readonly amount: string;
  readonly settlementAmount: string | null;
  readonly settlementCurrencyCode: string;
  readonly effectiveDate: Date;
  readonly settlementDecimalPrecision: number;
};

export const MONTHLY_BRAND_MATRIX_INVALID_INPUT =
  "Check the monthly brand matrix filters and try again.";
export const MONTHLY_BRAND_MATRIX_FORBIDDEN =
  "You do not have permission to view the monthly brand matrix.";
export const MONTHLY_BRAND_MATRIX_UNAVAILABLE = "Monthly brand matrix is temporarily unavailable.";
export const MONTHLY_BRAND_MATRIX_SETTINGS_MISSING =
  "System reporting currency is not configured. Configure it in Settings before running this report.";

/**
 * Reporting Group Rollups (§13.3 / TASK-089).
 * KPIs and monthly-matrix summaries aggregated by reporting group — never as transaction owner.
 * Currency buckets stay separate (BR-013). Matrix amounts use configured reporting currency equivalents.
 */
export type ReportingGroupRollupSourceGroup = {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly companies: readonly MonthlyBrandMatrixSourceCompany[];
};

export type ReportingGroupRollupSourceInvoice = CompanyPerformanceSourceInvoice & {
  readonly reportingGroupId: string | null;
};

export type ReportingGroupRollupSourcePayment = CompanyPerformanceSourcePayment & {
  readonly reportingGroupId: string | null;
};

export type ReportingGroupRollupMatrixSummary = MonthlyBrandMatrixSummary & {
  readonly skippedConversionCount: number;
};

export type ReportingGroupRollupRow = {
  readonly reportingGroupId: string;
  readonly reportingGroupName: string;
  readonly reportingGroupCode: string;
  readonly companyIds: readonly string[];
  readonly companyCount: number;
  /** Invoice-currency KPI buckets rolled up across member companies. */
  readonly invoiceCurrencies: readonly DashboardInvoiceCurrencyKpis[];
  /** Settlement-currency KPI buckets from stored payment snapshots (BR-020). */
  readonly settlementCurrencies: readonly DashboardSettlementCurrencyKpis[];
  readonly invoiceCount: number;
  readonly paymentCount: number;
  /** Monthly brand matrix summary for the selected year in reporting currency. */
  readonly matrixSummary: ReportingGroupRollupMatrixSummary | null;
};

export type ReportingGroupRollupPayload = {
  readonly year: number;
  readonly reportingCurrencyCode: string;
  readonly reportingCurrencyLabel: string;
  readonly decimalPrecision: number;
  readonly rows: readonly ReportingGroupRollupRow[];
};

export const REPORTING_GROUP_ROLLUP_INVALID_INPUT =
  "Check the reporting group rollup filters and try again.";
export const REPORTING_GROUP_ROLLUP_FORBIDDEN =
  "You do not have permission to view reporting group rollups.";
export const REPORTING_GROUP_ROLLUP_UNAVAILABLE =
  "Reporting group rollups are temporarily unavailable.";
export const REPORTING_GROUP_ROLLUP_SETTINGS_MISSING =
  "System reporting currency is not configured. Configure it in Settings before running this report.";
