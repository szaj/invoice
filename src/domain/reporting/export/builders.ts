import type { ReportExportBuildResult, ReportExportSheet } from "@/domain/reporting/export/types";
import type {
  CompanyPerformancePayload,
  ComplianceReportPayload,
  CurrencyReportPayload,
  CustomerReportPayload,
  GatewayReportPayload,
  InvoiceReportPayload,
  MonthlyBrandMatrixPayload,
  OutstandingReportPayload,
  OverdueAgingPayload,
  PaymentReportPayload,
  ReportingGroupRollupPayload,
  StaffPerformancePayload,
} from "@/domain/reporting/types";

function tabularResult(
  name: string,
  headers: readonly string[],
  rows: readonly (readonly string[])[],
  rowCount: number,
  totals: Record<string, unknown>,
  summaryRows?: readonly (readonly string[])[],
): ReportExportBuildResult {
  const sheet: ReportExportSheet = { name, headers, rows, summaryRows };
  return { sheets: [sheet], rowCount, totals };
}

export function buildInvoiceReportExport(payload: InvoiceReportPayload): ReportExportBuildResult {
  const headers = [
    "invoiceId",
    "invoiceNumber",
    "customerId",
    "customer",
    "companyId",
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
  const rows = payload.rows.map((row) => [
    row.id,
    row.invoiceNumber ?? "",
    row.customerId,
    row.customerDisplayName,
    row.companyId,
    row.companyDisplayName,
    row.invoiceDate,
    row.dueDate,
    row.currencyCode,
    row.invoiceTotal,
    row.confirmedPaidAmount,
    row.outstandingAmount,
    row.status,
    row.assignedStaffName ?? "",
  ]);
  return tabularResult(
    "Invoices",
    headers,
    rows,
    payload.totalCount,
    { totalCount: payload.totalCount, sortBy: payload.sortBy, sortDir: payload.sortDir },
    [["totalCount", String(payload.totalCount)]],
  );
}

export function buildPaymentReportExport(payload: PaymentReportPayload): ReportExportBuildResult {
  const headers = [
    "paymentId",
    "invoiceId",
    "invoiceNumber",
    "customerId",
    "customer",
    "method",
    "transactionId",
    "invoiceCurrency",
    "amountApplied",
    "fixedRate",
    "rateSource",
    "settlementCurrency",
    "convertedSettlement",
    "processorFee",
    "actualReceived",
    "paymentDate",
    "status",
  ] as const;
  const rows = payload.rows.map((row) => [
    row.id,
    row.invoiceId,
    row.invoiceNumber ?? "",
    row.customerId,
    row.customerDisplayName,
    row.methodCode,
    row.externalTransactionId ?? "",
    row.invoiceCurrencyCode,
    row.invoiceAmountApplied,
    row.fixedConversionRate,
    row.rateSource,
    row.settlementCurrencyCode,
    row.convertedSettlementAmount,
    row.processorFeeAmount ?? "",
    row.actualReceivedAmount ?? "",
    row.paymentDate,
    row.status,
  ]);
  return tabularResult(
    "Payments",
    headers,
    rows,
    payload.totalCount,
    { totalCount: payload.totalCount, sortBy: payload.sortBy, sortDir: payload.sortDir },
    [["totalCount", String(payload.totalCount)]],
  );
}

export function buildOutstandingReportExport(
  payload: OutstandingReportPayload,
): ReportExportBuildResult {
  const headers = [
    "invoiceId",
    "invoiceNumber",
    "customerId",
    "customer",
    "companyId",
    "company",
    "dueDate",
    "ageDays",
    "currency",
    "outstanding",
    "status",
    "staff",
  ] as const;
  const rows = payload.rows.map((row) => [
    row.id,
    row.invoiceNumber ?? "",
    row.customerId,
    row.customerDisplayName,
    row.companyId,
    row.companyDisplayName,
    row.dueDate,
    String(row.ageDays),
    row.currencyCode,
    row.outstandingAmount,
    row.status,
    row.assignedStaffName ?? "",
  ]);
  return tabularResult(
    "Outstanding",
    headers,
    rows,
    payload.totalCount,
    { totalCount: payload.totalCount },
    [["totalCount", String(payload.totalCount)]],
  );
}

export function buildOverdueAgingReportExport(
  payload: OverdueAgingPayload,
): ReportExportBuildResult {
  const headers = ["bucket", "currency", "outstanding", "invoiceCount"] as const;
  const rows: string[][] = [];
  let invoiceCount = 0;
  for (const bucket of payload.buckets) {
    invoiceCount += bucket.invoiceCount;
    if (bucket.currencies.length === 0) {
      rows.push([bucket.label, "", "0", "0"]);
      continue;
    }
    for (const currency of bucket.currencies) {
      rows.push([
        bucket.label,
        currency.currencyCode,
        currency.outstandingAmount,
        String(currency.invoiceCount),
      ]);
    }
  }
  return tabularResult(
    "Overdue Aging",
    headers,
    rows,
    rows.length,
    { asOf: payload.asOf, invoiceCount },
    [
      ["asOf", payload.asOf],
      ["invoiceCount", String(invoiceCount)],
    ],
  );
}

export function buildCustomerReportExport(payload: CustomerReportPayload): ReportExportBuildResult {
  const headers = [
    "customerId",
    "customer",
    "currency",
    "totalInvoiced",
    "totalPaid",
    "outstanding",
    "invoiceCount",
  ] as const;
  const rows = payload.rows.map((row) => [
    row.customerId,
    row.customerDisplayName,
    row.currencyCode,
    row.totalInvoiced,
    row.totalPaid,
    row.outstanding,
    String(row.invoiceCount),
  ]);
  return tabularResult(
    "Customers",
    headers,
    rows,
    payload.totalCount,
    { totalCount: payload.totalCount },
    [["totalCount", String(payload.totalCount)]],
  );
}

export function buildCompanyPerformanceExport(
  payload: CompanyPerformancePayload,
): ReportExportBuildResult {
  const summaryHeaders = ["metric", "currency", "amount"] as const;
  const summaryRows: string[][] = [];
  for (const row of payload.rows) {
    summaryRows.push([`company:${row.companyDisplayName}`, "", ""]);
    for (const bucket of row.invoiceCurrencies) {
      summaryRows.push([
        "invoice",
        bucket.currencyCode,
        `invoiced=${bucket.totalInvoiced}; paid=${bucket.totalPaid}; outstanding=${bucket.outstanding}; overdue=${bucket.overdue}`,
      ]);
    }
    for (const bucket of row.settlementCurrencies) {
      summaryRows.push([
        "settlement",
        bucket.currencyCode,
        `converted=${bucket.convertedSettlement}; fees=${bucket.processorFees}; received=${bucket.actualReceived}`,
      ]);
    }
    summaryRows.push(["counts", "", `invoices=${row.invoiceCount}; payments=${row.paymentCount}`]);
  }
  return tabularResult(
    "Company Performance",
    summaryHeaders,
    summaryRows,
    payload.totalCount,
    { totalCount: payload.totalCount },
    [["totalCount", String(payload.totalCount)]],
  );
}

export function buildStaffPerformanceExport(
  payload: StaffPerformancePayload,
): ReportExportBuildResult {
  const headers = [
    "staffUserId",
    "staff",
    "invoicesCreated",
    "invoicesSent",
    "collectionsCount",
    "metric",
    "currency",
    "amount",
  ] as const;
  const rows: string[][] = [];
  for (const row of payload.rows) {
    const base = [
      row.staffUserId,
      row.staffDisplayName,
      String(row.invoicesCreated),
      String(row.invoicesSent),
      String(row.collectionsCount),
    ];
    if (row.valueInvoiced.length === 0 && row.collections.length === 0) {
      rows.push([...base, "", "", ""]);
      continue;
    }
    let first = true;
    for (const bucket of row.valueInvoiced) {
      rows.push([
        ...(first ? base : ["", "", "", "", ""]),
        "valueInvoiced",
        bucket.currencyCode,
        bucket.amount,
      ]);
      first = false;
    }
    for (const bucket of row.collections) {
      rows.push([
        ...(first ? base : ["", "", "", "", ""]),
        "collections",
        bucket.currencyCode,
        bucket.amount,
      ]);
      first = false;
    }
  }
  return tabularResult(
    "Staff Performance",
    headers,
    rows,
    payload.totalCount,
    { totalCount: payload.totalCount },
    [["totalCount", String(payload.totalCount)]],
  );
}

export function buildGatewayReportExport(payload: GatewayReportPayload): ReportExportBuildResult {
  const headers = [
    "gateway",
    "settlementCurrency",
    "transactionCount",
    "failureCount",
    "convertedSettlement",
    "processorFees",
    "actualReceived",
    "refundCount",
    "refunds",
  ] as const;
  const rows = payload.rows.map((row) => [
    row.methodCode,
    row.settlementCurrencyCode,
    String(row.transactionCount),
    String(row.failureCount),
    row.convertedSettlement,
    row.processorFees,
    row.actualReceived,
    String(row.refundCount),
    row.refunds,
  ]);
  return tabularResult(
    "Gateways",
    headers,
    rows,
    payload.totalCount,
    { totalCount: payload.totalCount },
    [["totalCount", String(payload.totalCount)]],
  );
}

export function buildCurrencyReportExport(payload: CurrencyReportPayload): ReportExportBuildResult {
  const invoiceRows = payload.invoiceCurrencies.map((row) => [
    "invoice",
    row.currencyCode,
    row.totalInvoiced,
    row.totalPaid,
    row.outstanding,
    row.overdue,
  ]);
  const settlementRows = payload.settlementCurrencies.map((row) => [
    "settlement",
    row.currencyCode,
    row.convertedSettlement,
    row.processorFees,
    row.actualReceived,
    "",
  ]);
  const headers = ["section", "currency", "col1", "col2", "col3", "col4"] as const;
  const rows = [...invoiceRows, ...settlementRows];
  return tabularResult(
    "Currencies",
    headers,
    rows,
    rows.length,
    {
      invoiceCurrencyCount: payload.invoiceCurrencies.length,
      settlementCurrencyCount: payload.settlementCurrencies.length,
    },
    [
      ["invoiceCurrencyCount", String(payload.invoiceCurrencies.length)],
      ["settlementCurrencyCount", String(payload.settlementCurrencies.length)],
    ],
  );
}

export function buildComplianceReportExport(
  payload: ComplianceReportPayload,
): ReportExportBuildResult {
  const statusSheet: ReportExportSheet = {
    name: "Status counts",
    headers: ["metric", "count"],
    rows: [
      ["notReviewed", String(payload.statusCounts.notReviewed)],
      ["underReview", String(payload.statusCounts.underReview)],
      ["approved", String(payload.statusCounts.approved)],
      ["flagged", String(payload.statusCounts.flagged)],
      ["pending", String(payload.statusCounts.pending)],
      ["total", String(payload.statusCounts.total)],
    ],
  };
  const byTypeSheet: ReportExportSheet = {
    name: "By subject type",
    headers: [
      "subjectType",
      "notReviewed",
      "underReview",
      "approved",
      "flagged",
      "pending",
      "total",
    ],
    rows: payload.bySubjectType.map((row) => [
      row.subjectType,
      String(row.notReviewed),
      String(row.underReview),
      String(row.approved),
      String(row.flagged),
      String(row.pending),
      String(row.total),
    ]),
  };
  const agingSheet: ReportExportSheet = {
    name: "Aging",
    headers: ["bucket", "pendingCount", "flaggedCount", "totalCount"],
    rows: payload.aging.map((row) => [
      row.label,
      String(row.pendingCount),
      String(row.flaggedCount),
      String(row.totalCount),
    ]),
  };
  const notesSheet: ReportExportSheet = {
    name: "Note references",
    headers: [
      "reviewId",
      "subjectType",
      "subjectId",
      "companyId",
      "status",
      "hasNotes",
      "hasReason",
      "hasResolutionNotes",
      "evidenceRefCount",
      "reviewerUserId",
      "createdAt",
      "label",
    ],
    rows: payload.noteReferences.map((row) => [
      row.reviewId,
      row.subjectType,
      row.subjectId,
      row.companyId,
      row.status,
      String(row.hasNotes),
      String(row.hasReason),
      String(row.hasResolutionNotes),
      String(row.evidenceRefCount),
      row.reviewerUserId ?? "",
      row.createdAt,
      row.label ?? "",
    ]),
    summaryRows: [["noteReferenceTotal", String(payload.noteReferenceTotal)]],
  };
  return {
    sheets: [statusSheet, byTypeSheet, agingSheet, notesSheet],
    rowCount: payload.noteReferences.length,
    totals: {
      statusCounts: payload.statusCounts,
      noteReferenceTotal: payload.noteReferenceTotal,
    },
  };
}

export function buildMonthlyBrandMatrixExport(
  payload: MonthlyBrandMatrixPayload,
): ReportExportBuildResult {
  const companyHeaders = payload.companies.map((company) => company.companyDisplayName);
  const headers = ["row", ...companyHeaders, "Monthly Total", "CB/RF", "Net G.Total"];
  const rows = payload.rows.map((row) => {
    const companyValues = payload.companies.map((column) => {
      const cell = row.companies.find((entry) => entry.companyId === column.companyId);
      return cell?.grossReceipts ?? "0";
    });
    return [row.label, ...companyValues, row.monthlyTotal, row.cbrf, row.netGTotal];
  });
  const summaryRows: string[][] = [
    ["reportingCurrency", payload.reportingCurrencyCode],
    ["year", String(payload.year)],
    ["currentMonthGross", payload.summary.currentMonthGross],
    ["currentMonthCbrf", payload.summary.currentMonthCbrf],
    ["currentMonthNet", payload.summary.currentMonthNet],
    ["annualGross", payload.summary.annualGross],
    ["annualCbrf", payload.summary.annualCbrf],
    ["annualNetGTotal", payload.summary.annualNetGTotal],
    ["openDisputes", payload.summary.openDisputes],
  ];
  return tabularResult(
    "Monthly Brand",
    headers,
    rows,
    rows.length,
    {
      year: payload.year,
      reportingCurrencyCode: payload.reportingCurrencyCode,
      summary: payload.summary,
    },
    summaryRows,
  );
}

export function buildReportingGroupRollupExport(
  payload: ReportingGroupRollupPayload,
): ReportExportBuildResult {
  const headers = [
    "reportingGroup",
    "code",
    "companyCount",
    "invoiceCount",
    "paymentCount",
    "metric",
    "currency",
    "amount",
  ] as const;
  const rows: string[][] = [];
  for (const row of payload.rows) {
    const base = [
      row.reportingGroupName,
      row.reportingGroupCode,
      String(row.companyCount),
      String(row.invoiceCount),
      String(row.paymentCount),
    ];
    let first = true;
    for (const bucket of row.invoiceCurrencies) {
      rows.push([
        ...(first ? base : ["", "", "", "", ""]),
        "invoice",
        bucket.currencyCode,
        `invoiced=${bucket.totalInvoiced}; paid=${bucket.totalPaid}; outstanding=${bucket.outstanding}`,
      ]);
      first = false;
    }
    for (const bucket of row.settlementCurrencies) {
      rows.push([
        ...(first ? base : ["", "", "", "", ""]),
        "settlement",
        bucket.currencyCode,
        `converted=${bucket.convertedSettlement}`,
      ]);
      first = false;
    }
    if (row.matrixSummary) {
      rows.push([
        ...(first ? base : ["", "", "", "", ""]),
        "matrixAnnualNet",
        payload.reportingCurrencyCode,
        row.matrixSummary.annualNetGTotal,
      ]);
    }
  }
  return tabularResult(
    "Reporting Groups",
    headers,
    rows,
    rows.length,
    {
      year: payload.year,
      reportingCurrencyCode: payload.reportingCurrencyCode,
      groupCount: payload.rows.length,
    },
    [
      ["year", String(payload.year)],
      ["reportingCurrency", payload.reportingCurrencyCode],
      ["groupCount", String(payload.rows.length)],
    ],
  );
}
