import { buildDashboardKpis } from "@/domain/reporting/dashboard-kpis";
import { buildMonthlyBrandMatrix } from "@/domain/reporting/monthly-brand-matrix";
import type { FixedConversionRateRecord } from "@/domain/fixed-rates/types";
import type {
  ReportingGroupRollupMatrixSummary,
  ReportingGroupRollupRow,
  ReportingGroupRollupSourceGroup,
  ReportingGroupRollupSourceInvoice,
  ReportingGroupRollupSourcePayment,
  MonthlyBrandMatrixSourceAdjustment,
  MonthlyBrandMatrixSourcePayment,
} from "@/domain/reporting/types";

/**
 * Reporting Group Rollup domain helpers (TASK-089 / §13.3).
 * Aggregates dashboard KPIs and monthly-matrix summaries by reporting group.
 * Transaction ownership stays on the original company — groups are roll-ups only.
 */

function companyIdsInGroup(group: ReportingGroupRollupSourceGroup): Set<string> {
  return new Set(group.companies.map((company) => company.id));
}

function filterRowsForGroup<T extends { companyId: string }>(
  rows: readonly T[],
  group: ReportingGroupRollupSourceGroup,
): T[] {
  const allowed = companyIdsInGroup(group);
  return rows.filter((row) => allowed.has(row.companyId));
}

function buildMatrixSummaryForGroup(input: {
  year: number;
  reportingCurrencyCode: string;
  decimalPrecision: number;
  group: ReportingGroupRollupSourceGroup;
  payments: readonly MonthlyBrandMatrixSourcePayment[];
  adjustments: readonly MonthlyBrandMatrixSourceAdjustment[];
  fixedRates: readonly FixedConversionRateRecord[];
  now?: Date;
}): ReportingGroupRollupMatrixSummary {
  const groupPayments = filterRowsForGroup(input.payments, input.group);
  const groupAdjustments = filterRowsForGroup(input.adjustments, input.group);
  const { payload } = buildMonthlyBrandMatrix({
    year: input.year,
    reportingCurrencyCode: input.reportingCurrencyCode,
    decimalPrecision: input.decimalPrecision,
    companies: input.group.companies,
    payments: groupPayments,
    adjustments: groupAdjustments,
    fixedRates: input.fixedRates,
    now: input.now,
  });

  return {
    ...payload.summary,
    skippedConversionCount: payload.skippedConversionCount,
  };
}

/**
 * Build one rollup row per reporting group from access-scoped source rows.
 * Ownership remains on member company ids — reportingGroupId is never a transaction owner.
 */
export function buildReportingGroupRollupRows(input: {
  readonly groups: readonly ReportingGroupRollupSourceGroup[];
  readonly invoices: readonly ReportingGroupRollupSourceInvoice[];
  readonly payments: readonly ReportingGroupRollupSourcePayment[];
  readonly matrixPayments: readonly MonthlyBrandMatrixSourcePayment[];
  readonly matrixAdjustments: readonly MonthlyBrandMatrixSourceAdjustment[];
  readonly fixedRates: readonly FixedConversionRateRecord[];
  readonly year: number;
  readonly reportingCurrencyCode: string;
  readonly decimalPrecision: number;
  readonly now?: Date;
}): ReportingGroupRollupRow[] {
  return input.groups.map((group) => {
    const groupInvoices = filterRowsForGroup(input.invoices, group);
    const groupPayments = filterRowsForGroup(input.payments, group);
    const kpis = buildDashboardKpis(groupInvoices, groupPayments);
    const matrixSummary = buildMatrixSummaryForGroup({
      year: input.year,
      reportingCurrencyCode: input.reportingCurrencyCode,
      decimalPrecision: input.decimalPrecision,
      group,
      payments: input.matrixPayments,
      adjustments: input.matrixAdjustments,
      fixedRates: input.fixedRates,
      now: input.now,
    });

    return {
      reportingGroupId: group.id,
      reportingGroupName: group.name,
      reportingGroupCode: group.code,
      companyIds: group.companies.map((company) => company.id),
      companyCount: group.companies.length,
      invoiceCurrencies: kpis.invoiceCurrencies,
      settlementCurrencies: kpis.settlementCurrencies,
      invoiceCount: groupInvoices.length,
      paymentCount: groupPayments.length,
      matrixSummary,
    };
  });
}

/**
 * BR-013: rollup rows must expose currency-scoped buckets only — no grandTotal.
 */
export function assertReportingGroupRollupHasNoUnlabeledMixedTotal(
  rows: readonly ReportingGroupRollupRow[],
): void {
  for (const row of rows) {
    if ("grandTotal" in row || "totalInvoiced" in row) {
      throw new Error("Reporting group rollup must not expose an unlabeled mixed-currency total.");
    }
    for (const bucket of row.invoiceCurrencies) {
      if (!bucket.currencyCode || String(bucket.currencyCode).trim().length === 0) {
        throw new Error("Reporting group rollup invoice bucket missing currency code.");
      }
    }
    for (const bucket of row.settlementCurrencies) {
      if (!bucket.currencyCode || String(bucket.currencyCode).trim().length === 0) {
        throw new Error("Reporting group rollup settlement bucket missing currency code.");
      }
    }
  }
}

/**
 * Ownership invariant: rows are keyed by reportingGroupId for roll-up display only.
 * Source invoices/payments must belong to member companies, never to the group id itself.
 */
export function assertReportingGroupRollupOwnershipIsMemberCompany(
  rows: readonly ReportingGroupRollupRow[],
  sourceCompanyIds: readonly string[],
): void {
  const allowed = new Set(sourceCompanyIds);
  for (const row of rows) {
    if (allowed.has(row.reportingGroupId)) {
      throw new Error("Reporting group id must not appear as a transaction-owning company.");
    }
    for (const companyId of row.companyIds) {
      if (!allowed.has(companyId) && companyId === row.reportingGroupId) {
        throw new Error("Reporting group must not be treated as transaction owner.");
      }
    }
  }
}
