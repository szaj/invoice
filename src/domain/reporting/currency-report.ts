import {
  assertDashboardHasNoUnlabeledMixedTotal,
  buildDashboardKpis,
} from "@/domain/reporting/dashboard-kpis";
import { moneyDecimal, normalizeCurrencyCode, toDecimalString } from "@/domain/money/decimal";
import { roundMoney } from "@/domain/money/round";
import type {
  CurrencyReportInvoiceRow,
  CurrencyReportPayload,
  CurrencyReportSettlementRow,
  CurrencyReportSortDir,
  CurrencyReportSortField,
  CurrencyReportSourceInvoice,
  CurrencyReportSourcePayment,
} from "@/domain/reporting/types";

/**
 * Currency Report domain helpers (TASK-086 / §13.3 / BR-013 / BR-020).
 * Invoice totals by invoice currency; settlement totals by settlement currency.
 * Reuses dashboard KPI aggregation — never collapses currencies without labels.
 */

/**
 * Build currency report totals from access-scoped invoice and payment rows.
 */
export function buildCurrencyReport(
  invoices: readonly CurrencyReportSourceInvoice[],
  payments: readonly CurrencyReportSourcePayment[],
  options: {
    readonly asOf?: Date;
    readonly sortBy?: CurrencyReportSortField;
    readonly sortDir?: CurrencyReportSortDir;
  } = {},
): CurrencyReportPayload {
  const kpis = buildDashboardKpis(invoices, payments, { asOf: options.asOf });
  assertDashboardHasNoUnlabeledMixedTotal(kpis);

  const sortBy = options.sortBy ?? "currency";
  const sortDir = options.sortDir ?? "asc";

  return {
    invoiceCurrencies: sortCurrencyInvoiceRows(kpis.invoiceCurrencies, sortBy, sortDir),
    settlementCurrencies: sortCurrencySettlementRows(kpis.settlementCurrencies, sortBy, sortDir),
    sortBy,
    sortDir,
  };
}

/**
 * Sort invoice-currency rows (default: currency code).
 */
export function sortCurrencyInvoiceRows(
  rows: readonly CurrencyReportInvoiceRow[],
  sortBy: CurrencyReportSortField,
  sortDir: CurrencyReportSortDir,
): CurrencyReportInvoiceRow[] {
  const dir = sortDir === "desc" ? -1 : 1;
  const sorted = [...rows];
  sorted.sort((left, right) => {
    // Only currency sort field is defined for TASK-086.
    void sortBy;
    const cmp = left.currencyCode.localeCompare(right.currencyCode);
    return cmp * dir;
  });
  return sorted;
}

/**
 * Sort settlement-currency rows (default: currency code).
 */
export function sortCurrencySettlementRows(
  rows: readonly CurrencyReportSettlementRow[],
  sortBy: CurrencyReportSortField,
  sortDir: CurrencyReportSortDir,
): CurrencyReportSettlementRow[] {
  const dir = sortDir === "desc" ? -1 : 1;
  const sorted = [...rows];
  sorted.sort((left, right) => {
    void sortBy;
    const cmp = left.currencyCode.localeCompare(right.currencyCode);
    return cmp * dir;
  });
  return sorted;
}

/**
 * BR-013 / TASK-086 excluded: each total must keep its currency label — no unlabeled collapse.
 */
export function assertCurrencyReportHasNoUnlabeledMixedTotal(payload: CurrencyReportPayload): void {
  if (!Array.isArray(payload.invoiceCurrencies) || !Array.isArray(payload.settlementCurrencies)) {
    throw new Error("Currency report must expose invoice and settlement currency rows.");
  }
  if ("grandTotal" in payload || "totalInvoiced" in payload || "totalSettlement" in payload) {
    throw new Error("Currency report must not expose an unlabeled mixed-currency total.");
  }
  for (const row of payload.invoiceCurrencies) {
    if (!row.currencyCode || String(row.currencyCode).trim().length === 0) {
      throw new Error("Currency report invoice row missing currency code.");
    }
  }
  for (const row of payload.settlementCurrencies) {
    if (!row.currencyCode || String(row.currencyCode).trim().length === 0) {
      throw new Error("Currency report settlement row missing currency code.");
    }
  }
}

/**
 * BR-020: settlement totals must equal stored snapshots; fees stay separate.
 */
export function assertCurrencyReportFeesSeparateFromSettlement(
  payload: CurrencyReportPayload,
  payments: readonly CurrencyReportSourcePayment[],
): void {
  for (const row of payload.settlementCurrencies) {
    const matching = payments.filter(
      (payment) =>
        payment.status === "SUCCESSFUL" &&
        normalizeCurrencyCode(payment.settlementCurrencyCode) ===
          normalizeCurrencyCode(row.currencyCode),
    );
    let expectedSettlement = moneyDecimal("0");
    let precision = 2;
    for (const payment of matching) {
      precision = payment.settlementDecimalPrecision;
      expectedSettlement = expectedSettlement.plus(
        roundMoney(
          moneyDecimal(payment.convertedSettlementAmount),
          payment.settlementDecimalPrecision,
        ),
      );
    }
    const expected = toDecimalString(roundMoney(expectedSettlement, precision));
    if (row.convertedSettlement !== expected) {
      throw new Error(
        "Currency report converted settlement must equal stored snapshots without deducting fees.",
      );
    }
  }
}
