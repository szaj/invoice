import { isCollectibleInvoiceStatus } from "@/domain/invoices/cancellation";
import type { InvoiceStatus } from "@/domain/invoices/types";
import { moneyDecimal, normalizeCurrencyCode, toDecimalString } from "@/domain/money/decimal";
import { roundMoney } from "@/domain/money/round";
import type {
  CustomerReportRow,
  CustomerReportSortDir,
  CustomerReportSortField,
  CustomerReportSourceInvoice,
} from "@/domain/reporting/types";

/**
 * Customer Report domain helpers (TASK-082 / §13.3 / BR-013).
 * Groups total invoiced / paid / outstanding by customer and invoice currency.
 * Draft and cancelled invoices are excluded (same collectible rule as dashboard / TASK-029).
 * Uses stored confirmed-application balances (BR-009). Does not invent ADR-011 rollup.
 */

type MutableBucket = {
  customerId: string;
  customerDisplayName: string;
  currencyCode: string;
  totalInvoiced: ReturnType<typeof moneyDecimal>;
  totalPaid: ReturnType<typeof moneyDecimal>;
  outstanding: ReturnType<typeof moneyDecimal>;
  invoiceCount: number;
  decimalPrecision: number;
};

function bucketKey(customerId: string, currencyCode: string): string {
  return `${customerId}\0${currencyCode}`;
}

/**
 * Collectible invoices only — draft/cancelled excluded from customer report totals.
 */
export function isCustomerReportEligible(invoice: { readonly status: InvoiceStatus }): boolean {
  return isCollectibleInvoiceStatus(invoice.status);
}

/**
 * Aggregate invoices into customer × currency rows (BR-013).
 * Callers must only pass invoices the actor may see (company/staff scope).
 */
export function buildCustomerReportRows(
  invoices: readonly CustomerReportSourceInvoice[],
): CustomerReportRow[] {
  const buckets = new Map<string, MutableBucket>();

  for (const invoice of invoices) {
    if (!isCustomerReportEligible(invoice)) {
      continue;
    }

    const currencyCode = normalizeCurrencyCode(invoice.currencyCode);
    const key = bucketKey(invoice.customerId, currencyCode);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        customerId: invoice.customerId,
        customerDisplayName: invoice.customerDisplayName,
        currencyCode,
        totalInvoiced: moneyDecimal("0"),
        totalPaid: moneyDecimal("0"),
        outstanding: moneyDecimal("0"),
        invoiceCount: 0,
        decimalPrecision: invoice.decimalPrecision,
      };
      buckets.set(key, bucket);
    }

    const invoiced = roundMoney(moneyDecimal(invoice.invoiceTotal), invoice.decimalPrecision);
    const paid = roundMoney(moneyDecimal(invoice.confirmedPaidAmount), invoice.decimalPrecision);
    const outstanding = roundMoney(
      moneyDecimal(invoice.outstandingAmount),
      invoice.decimalPrecision,
    );

    bucket.totalInvoiced = bucket.totalInvoiced.plus(invoiced);
    bucket.totalPaid = bucket.totalPaid.plus(paid);
    bucket.outstanding = bucket.outstanding.plus(outstanding);
    bucket.invoiceCount += 1;
  }

  return [...buckets.values()].map((bucket) => ({
    customerId: bucket.customerId,
    customerDisplayName: bucket.customerDisplayName,
    currencyCode: bucket.currencyCode,
    totalInvoiced: toDecimalString(roundMoney(bucket.totalInvoiced, bucket.decimalPrecision)),
    totalPaid: toDecimalString(roundMoney(bucket.totalPaid, bucket.decimalPrecision)),
    outstanding: toDecimalString(roundMoney(bucket.outstanding, bucket.decimalPrecision)),
    invoiceCount: bucket.invoiceCount,
    decimalPrecision: bucket.decimalPrecision,
  }));
}

function compareMoneyStrings(a: string, b: string): number {
  return moneyDecimal(a).comparedTo(moneyDecimal(b));
}

/**
 * Sort customer × currency rows for report pagination.
 */
export function sortCustomerReportRows(
  rows: readonly CustomerReportRow[],
  sortBy: CustomerReportSortField,
  sortDir: CustomerReportSortDir,
): CustomerReportRow[] {
  const dir = sortDir === "desc" ? -1 : 1;
  const sorted = [...rows];
  sorted.sort((left, right) => {
    let cmp = 0;
    switch (sortBy) {
      case "currency":
        cmp = left.currencyCode.localeCompare(right.currencyCode);
        break;
      case "invoiced":
        cmp = compareMoneyStrings(left.totalInvoiced, right.totalInvoiced);
        break;
      case "paid":
        cmp = compareMoneyStrings(left.totalPaid, right.totalPaid);
        break;
      case "outstanding":
        cmp = compareMoneyStrings(left.outstanding, right.outstanding);
        break;
      case "invoiceCount":
        cmp = left.invoiceCount - right.invoiceCount;
        break;
      case "customer":
      default:
        cmp = left.customerDisplayName.localeCompare(right.customerDisplayName);
        break;
    }
    if (cmp !== 0) {
      return cmp * dir;
    }
    // Stable secondary: customer name, then currency.
    const byName = left.customerDisplayName.localeCompare(right.customerDisplayName);
    if (byName !== 0) {
      return byName;
    }
    return left.currencyCode.localeCompare(right.currencyCode);
  });
  return sorted;
}

/**
 * Paginate already-sorted customer report rows.
 */
export function paginateCustomerReportRows(
  rows: readonly CustomerReportRow[],
  page: number,
  pageSize: number,
): { readonly rows: readonly CustomerReportRow[]; readonly totalCount: number } {
  const totalCount = rows.length;
  const start = Math.max(0, (page - 1) * pageSize);
  return {
    rows: rows.slice(start, start + pageSize),
    totalCount,
  };
}

/**
 * BR-013: payload must expose currency-scoped customer rows only — no grandTotal.
 */
export function assertCustomerReportHasNoUnlabeledMixedTotal(
  rows: readonly CustomerReportRow[],
): void {
  if (!Array.isArray(rows)) {
    throw new Error("Customer report must expose currency-scoped rows only.");
  }
  for (const row of rows) {
    if (!row.currencyCode || String(row.currencyCode).trim().length === 0) {
      throw new Error("Customer report row missing currency code.");
    }
  }
}
