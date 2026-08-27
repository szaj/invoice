import {
  computeCbrf,
  computeGrossReceipts,
  computeNetGTotal,
  sumOpenDisputeAmounts,
  type CbrfAdjustmentInput,
  type GrossReceiptsPaymentInput,
} from "@/domain/money/cbrf";
import { sumMoney } from "@/domain/money/convert";
import { toDecimalString } from "@/domain/money/decimal";
import { roundMoney } from "@/domain/money/round";
import type { FixedConversionRateRecord } from "@/domain/fixed-rates/types";
import { isOpenDisputeExcludedFromCbrf } from "@/domain/money/cbrf";
import { convertSettlementAmountToReportingCurrency } from "@/domain/reporting/reporting-currency-amount";
import type {
  MonthlyBrandMatrixCompanyCell,
  MonthlyBrandMatrixCompanyColumn,
  MonthlyBrandMatrixDrillDown,
  MonthlyBrandMatrixPayload,
  MonthlyBrandMatrixRow,
  MonthlyBrandMatrixSourceAdjustment,
  MonthlyBrandMatrixSourceCompany,
  MonthlyBrandMatrixSourcePayment,
  MonthlyBrandMatrixSummary,
} from "@/domain/reporting/types";

export const MONTHLY_BRAND_MATRIX_MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const MONTHLY_BRAND_MATRIX_G_TOTAL_LABEL = "G.Total";

export function utcCalendarMonth(date: Date): number {
  return date.getUTCMonth() + 1;
}

export function yearUtcBounds(year: number): { readonly from: Date; readonly to: Date } {
  return {
    from: new Date(Date.UTC(year, 0, 1)),
    to: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
  };
}

type MonthBucket = {
  grossByCompany: Map<string, { amount: string; paymentIds: string[] }>;
  grossPayments: GrossReceiptsPaymentInput[];
  grossPaymentIds: string[];
  cbrfAdjustments: CbrfAdjustmentInput[];
  cbrfAdjustmentIds: string[];
  openDisputeAdjustments: CbrfAdjustmentInput[];
};

function emptyDrillDown(): MonthlyBrandMatrixDrillDown {
  return { paymentIds: [], adjustmentIds: [] };
}

function createMonthBuckets(): Map<number, MonthBucket> {
  const buckets = new Map<number, MonthBucket>();
  for (let month = 1; month <= 12; month += 1) {
    buckets.set(month, {
      grossByCompany: new Map(),
      grossPayments: [],
      grossPaymentIds: [],
      cbrfAdjustments: [],
      cbrfAdjustmentIds: [],
      openDisputeAdjustments: [],
    });
  }
  return buckets;
}

function adjustmentSettlementAmount(row: MonthlyBrandMatrixSourceAdjustment): string {
  return row.settlementAmount ?? row.amount;
}

function addGrossPayment(
  bucket: MonthBucket,
  companyId: string,
  paymentId: string,
  reportingAmount: string,
  decimalPrecision: number,
): void {
  bucket.grossPayments.push({ status: "SUCCESSFUL", amount: reportingAmount });
  bucket.grossPaymentIds.push(paymentId);

  const existing = bucket.grossByCompany.get(companyId);
  if (existing) {
    existing.amount = toDecimalString(
      roundMoney(sumMoney([existing.amount, reportingAmount]), decimalPrecision),
    );
    existing.paymentIds.push(paymentId);
  } else {
    bucket.grossByCompany.set(companyId, { amount: reportingAmount, paymentIds: [paymentId] });
  }
}

function addCbrfAdjustment(
  bucket: MonthBucket,
  adjustment: MonthlyBrandMatrixSourceAdjustment,
  reportingAmount: string,
): void {
  bucket.cbrfAdjustments.push({
    type: adjustment.type,
    status: adjustment.status,
    amount: reportingAmount,
  });
  bucket.cbrfAdjustmentIds.push(adjustment.id);
}

function addOpenDisputeAdjustment(
  bucket: MonthBucket,
  adjustment: MonthlyBrandMatrixSourceAdjustment,
  reportingAmount: string,
): void {
  bucket.openDisputeAdjustments.push({
    type: adjustment.type,
    status: adjustment.status,
    amount: reportingAmount,
  });
}

function buildCompanyCells(
  companies: readonly MonthlyBrandMatrixSourceCompany[],
  grossByCompany: Map<string, { amount: string; paymentIds: string[] }>,
  decimalPrecision: number,
): MonthlyBrandMatrixCompanyCell[] {
  return companies.map((company) => {
    const bucket = grossByCompany.get(company.id);
    return {
      companyId: company.id,
      grossReceipts: bucket?.amount ?? toDecimalString(roundMoney("0", decimalPrecision)),
      drillDown: {
        paymentIds: bucket?.paymentIds ?? [],
        adjustmentIds: [],
      },
    };
  });
}

function buildMatrixRow(input: {
  rowKey: MonthlyBrandMatrixRow["rowKey"];
  month: number | null;
  label: string;
  companies: readonly MonthlyBrandMatrixSourceCompany[];
  bucket: MonthBucket;
  reportingCurrencyCode: string;
  decimalPrecision: number;
}): MonthlyBrandMatrixRow {
  const grossReceipts = computeGrossReceipts({
    payments: input.bucket.grossPayments,
    currencyCode: input.reportingCurrencyCode,
    decimalPrecision: input.decimalPrecision,
  });
  const cbrf = computeCbrf({
    adjustments: input.bucket.cbrfAdjustments,
    currencyCode: input.reportingCurrencyCode,
    decimalPrecision: input.decimalPrecision,
  });
  const netGTotal = computeNetGTotal({
    grossReceipts: grossReceipts.amount,
    cbrf: cbrf.amount,
    currencyCode: input.reportingCurrencyCode,
    decimalPrecision: input.decimalPrecision,
  });

  return {
    rowKey: input.rowKey,
    month: input.month,
    label: input.label,
    companies: buildCompanyCells(
      input.companies,
      input.bucket.grossByCompany,
      input.decimalPrecision,
    ),
    monthlyTotal: grossReceipts.amount,
    cbrf: cbrf.amount,
    netGTotal: netGTotal.amount,
    drillDown: {
      paymentIds: [...input.bucket.grossPaymentIds],
      adjustmentIds: [...input.bucket.cbrfAdjustmentIds],
    },
  };
}

function buildSummary(input: {
  year: number;
  rows: readonly MonthlyBrandMatrixRow[];
  openDisputeAdjustments: readonly CbrfAdjustmentInput[];
  reportingCurrencyCode: string;
  decimalPrecision: number;
  now: Date;
}): MonthlyBrandMatrixSummary {
  const monthRows = input.rows.filter((row) => row.rowKey !== "g-total");
  const gTotalRow = input.rows.find((row) => row.rowKey === "g-total");

  const currentUtcYear = input.now.getUTCFullYear();
  const currentUtcMonth = input.year === currentUtcYear ? utcCalendarMonth(input.now) : null;

  const currentMonthRow =
    currentUtcMonth == null
      ? null
      : (monthRows.find((row) => row.month === currentUtcMonth) ?? null);

  const openDisputes = sumOpenDisputeAmounts({
    adjustments: input.openDisputeAdjustments,
    currencyCode: input.reportingCurrencyCode,
    decimalPrecision: input.decimalPrecision,
  });

  return {
    currentMonth: currentUtcMonth,
    currentMonthLabel:
      currentUtcMonth == null
        ? null
        : (MONTHLY_BRAND_MATRIX_MONTH_LABELS[currentUtcMonth - 1] ?? null),
    currentMonthGross: currentMonthRow?.monthlyTotal ?? "0",
    currentMonthCbrf: currentMonthRow?.cbrf ?? "0",
    currentMonthNet: currentMonthRow?.netGTotal ?? "0",
    annualGross: gTotalRow?.monthlyTotal ?? "0",
    annualCbrf: gTotalRow?.cbrf ?? "0",
    annualNetGTotal: gTotalRow?.netGTotal ?? "0",
    openDisputes: openDisputes.amount,
  };
}

export type BuildMonthlyBrandMatrixInput = {
  readonly year: number;
  readonly reportingCurrencyCode: string;
  readonly decimalPrecision: number;
  readonly companies: readonly MonthlyBrandMatrixSourceCompany[];
  readonly payments: readonly MonthlyBrandMatrixSourcePayment[];
  readonly adjustments: readonly MonthlyBrandMatrixSourceAdjustment[];
  readonly fixedRates: readonly FixedConversionRateRecord[];
  readonly now?: Date;
};

export type BuildMonthlyBrandMatrixResult = {
  readonly payload: MonthlyBrandMatrixPayload;
  readonly skippedPaymentIds: readonly string[];
  readonly skippedAdjustmentIds: readonly string[];
};

/**
 * Spreadsheet-style monthly brand matrix (TASK-088 / §13.3.1).
 * Gross by company/month from SUCCESSFUL payments (payment date).
 * CB/RF by month from adjustments (effective date). Open disputes excluded (BR-024).
 */
export function buildMonthlyBrandMatrix(
  input: BuildMonthlyBrandMatrixInput,
): BuildMonthlyBrandMatrixResult {
  const now = input.now ?? new Date();
  const buckets = createMonthBuckets();
  const skippedPaymentIds: string[] = [];
  const skippedAdjustmentIds: string[] = [];
  const allOpenDisputeAdjustments: CbrfAdjustmentInput[] = [];

  for (const payment of input.payments) {
    if (payment.status !== "SUCCESSFUL") {
      continue;
    }
    const month = utcCalendarMonth(payment.paymentDate);
    const bucket = buckets.get(month);
    if (!bucket) {
      continue;
    }

    const converted = convertSettlementAmountToReportingCurrency({
      settlementAmount: payment.convertedSettlementAmount,
      settlementCurrencyCode: payment.settlementCurrencyCode,
      reportingCurrencyCode: input.reportingCurrencyCode,
      at: payment.paymentDate,
      decimalPrecision: input.decimalPrecision,
      fixedRates: input.fixedRates,
    });
    if (!converted.ok) {
      skippedPaymentIds.push(payment.id);
      continue;
    }

    addGrossPayment(
      bucket,
      payment.companyId,
      payment.id,
      converted.amount,
      input.decimalPrecision,
    );
  }

  for (const adjustment of input.adjustments) {
    const month = utcCalendarMonth(adjustment.effectiveDate);
    const bucket = buckets.get(month);
    if (!bucket) {
      continue;
    }

    const converted = convertSettlementAmountToReportingCurrency({
      settlementAmount: adjustmentSettlementAmount(adjustment),
      settlementCurrencyCode: adjustment.settlementCurrencyCode,
      reportingCurrencyCode: input.reportingCurrencyCode,
      at: adjustment.effectiveDate,
      decimalPrecision: input.decimalPrecision,
      fixedRates: input.fixedRates,
    });
    if (!converted.ok) {
      skippedAdjustmentIds.push(adjustment.id);
      continue;
    }

    const cbrfInput: CbrfAdjustmentInput = {
      type: adjustment.type,
      status: adjustment.status,
      amount: converted.amount,
    };

    if (isOpenDisputeExcludedFromCbrf(cbrfInput)) {
      addOpenDisputeAdjustment(bucket, adjustment, converted.amount);
      allOpenDisputeAdjustments.push(cbrfInput);
      continue;
    }

    addCbrfAdjustment(bucket, adjustment, converted.amount);
  }

  const monthRows: MonthlyBrandMatrixRow[] = [];
  for (let month = 1; month <= 12; month += 1) {
    const bucket = buckets.get(month)!;
    monthRows.push(
      buildMatrixRow({
        rowKey: `month-${month}` as MonthlyBrandMatrixRow["rowKey"],
        month,
        label: MONTHLY_BRAND_MATRIX_MONTH_LABELS[month - 1] ?? `Month ${month}`,
        companies: input.companies,
        bucket,
        reportingCurrencyCode: input.reportingCurrencyCode,
        decimalPrecision: input.decimalPrecision,
      }),
    );
  }

  const gTotalBucket: MonthBucket = {
    grossByCompany: new Map(),
    grossPayments: [],
    grossPaymentIds: [],
    cbrfAdjustments: [],
    cbrfAdjustmentIds: [],
    openDisputeAdjustments: [],
  };

  for (let month = 1; month <= 12; month += 1) {
    const bucket = buckets.get(month)!;
    for (const [companyId, data] of bucket.grossByCompany.entries()) {
      const existing = gTotalBucket.grossByCompany.get(companyId);
      if (existing) {
        existing.amount = toDecimalString(
          roundMoney(sumMoney([existing.amount, data.amount]), input.decimalPrecision),
        );
        existing.paymentIds.push(...data.paymentIds);
      } else {
        gTotalBucket.grossByCompany.set(companyId, {
          amount: data.amount,
          paymentIds: [...data.paymentIds],
        });
      }
    }
    gTotalBucket.grossPayments.push(...bucket.grossPayments);
    gTotalBucket.grossPaymentIds.push(...bucket.grossPaymentIds);
    gTotalBucket.cbrfAdjustments.push(...bucket.cbrfAdjustments);
    gTotalBucket.cbrfAdjustmentIds.push(...bucket.cbrfAdjustmentIds);
  }

  const gTotalRow = buildMatrixRow({
    rowKey: "g-total",
    month: null,
    label: MONTHLY_BRAND_MATRIX_G_TOTAL_LABEL,
    companies: input.companies,
    bucket: gTotalBucket,
    reportingCurrencyCode: input.reportingCurrencyCode,
    decimalPrecision: input.decimalPrecision,
  });

  // Override company cells with summed values (buildMatrixRow uses bucket maps — already correct).
  const rows = [...monthRows, gTotalRow];

  const companyColumns: MonthlyBrandMatrixCompanyColumn[] = input.companies.map((company) => {
    const cell = gTotalRow.companies.find((entry) => entry.companyId === company.id);
    return {
      companyId: company.id,
      companyDisplayName: company.displayName,
      annualGross: cell?.grossReceipts ?? "0",
      drillDown: cell?.drillDown ?? emptyDrillDown(),
    };
  });

  const summary = buildSummary({
    year: input.year,
    rows,
    openDisputeAdjustments: allOpenDisputeAdjustments,
    reportingCurrencyCode: input.reportingCurrencyCode,
    decimalPrecision: input.decimalPrecision,
    now,
  });

  return {
    payload: {
      year: input.year,
      reportingCurrencyCode: input.reportingCurrencyCode,
      reportingCurrencyLabel: `${input.reportingCurrencyCode} equivalent`,
      decimalPrecision: input.decimalPrecision,
      dateBasis: "payment_received_effective",
      companies: companyColumns,
      rows,
      summary,
      skippedConversionCount: skippedPaymentIds.length + skippedAdjustmentIds.length,
    },
    skippedPaymentIds,
    skippedAdjustmentIds,
  };
}

/** Assert matrix totals are labeled in one reporting currency (BR-013). */
export function assertMonthlyBrandMatrixUsesReportingCurrency(
  payload: MonthlyBrandMatrixPayload,
): void {
  if (!payload.reportingCurrencyCode || payload.reportingCurrencyCode.trim().length !== 3) {
    throw new Error("Monthly brand matrix must declare a reporting currency label (BR-013).");
  }
}
