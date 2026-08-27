import { isCollectibleInvoiceStatus } from "@/domain/invoices/cancellation";
import { moneyDecimal, normalizeCurrencyCode, toDecimalString } from "@/domain/money/decimal";
import { roundMoney } from "@/domain/money/round";
import type {
  StaffPerformanceCurrencyAmount,
  StaffPerformanceRow,
  StaffPerformanceSortDir,
  StaffPerformanceSortField,
  StaffPerformanceSourceInvoice,
  StaffPerformanceSourcePayment,
} from "@/domain/reporting/types";

/**
 * Staff Performance domain helpers (TASK-084 / §13.3 / BR-013).
 * - Invoices created/sent attributed to createdByUserId.
 * - Value invoiced = collectible totals for invoices created by the staff user.
 * - Collections = confirmed payment applications linked to assigned invoices.
 * - Does not invent commission.
 */

type MutableCurrencyBucket = {
  currencyCode: string;
  amount: ReturnType<typeof moneyDecimal>;
  decimalPrecision: number;
};

type MutableStaffBucket = {
  staffUserId: string;
  staffDisplayName: string;
  invoicesCreated: number;
  invoicesSent: number;
  valueInvoiced: Map<string, MutableCurrencyBucket>;
  collections: Map<string, MutableCurrencyBucket>;
  collectionPaymentIds: Set<string>;
};

function ensureStaffBucket(
  buckets: Map<string, MutableStaffBucket>,
  staffUserId: string,
  staffDisplayName: string | null,
): MutableStaffBucket {
  let bucket = buckets.get(staffUserId);
  if (!bucket) {
    bucket = {
      staffUserId,
      staffDisplayName: staffDisplayName?.trim() || staffUserId,
      invoicesCreated: 0,
      invoicesSent: 0,
      valueInvoiced: new Map(),
      collections: new Map(),
      collectionPaymentIds: new Set(),
    };
    buckets.set(staffUserId, bucket);
  } else if (
    staffDisplayName &&
    staffDisplayName.trim().length > 0 &&
    (bucket.staffDisplayName === staffUserId || bucket.staffDisplayName.length === 0)
  ) {
    bucket.staffDisplayName = staffDisplayName.trim();
  }
  return bucket;
}

function addCurrencyAmount(
  map: Map<string, MutableCurrencyBucket>,
  currencyCode: string,
  amount: string,
  decimalPrecision: number,
): void {
  const code = normalizeCurrencyCode(currencyCode);
  let bucket = map.get(code);
  if (!bucket) {
    bucket = {
      currencyCode: code,
      amount: moneyDecimal("0"),
      decimalPrecision,
    };
    map.set(code, bucket);
  }
  const rounded = roundMoney(moneyDecimal(amount), decimalPrecision);
  bucket.amount = bucket.amount.plus(rounded);
}

function finalizeCurrencyBuckets(
  map: Map<string, MutableCurrencyBucket>,
): StaffPerformanceCurrencyAmount[] {
  return [...map.values()]
    .sort((a, b) => a.currencyCode.localeCompare(b.currencyCode))
    .map((bucket) => ({
      currencyCode: bucket.currencyCode,
      amount: toDecimalString(roundMoney(bucket.amount, bucket.decimalPrecision)),
    }));
}

/**
 * Issued/sent = invoice number assigned at issue time (drafts and draft-cancels have null).
 */
export function isStaffPerformanceInvoiceSent(invoice: {
  readonly invoiceNumber: string | null;
}): boolean {
  return invoice.invoiceNumber != null && String(invoice.invoiceNumber).trim().length > 0;
}

/**
 * Build one performance row per staff user from access-scoped source rows.
 * Created/sent/value use creator attribution; collections use assignee attribution.
 * Never invents commission.
 */
export function buildStaffPerformanceRows(
  invoices: readonly StaffPerformanceSourceInvoice[],
  payments: readonly StaffPerformanceSourcePayment[],
): StaffPerformanceRow[] {
  const buckets = new Map<string, MutableStaffBucket>();

  for (const invoice of invoices) {
    if (!invoice.createdByUserId) {
      continue;
    }
    const bucket = ensureStaffBucket(buckets, invoice.createdByUserId, invoice.createdByName);
    bucket.invoicesCreated += 1;
    if (isStaffPerformanceInvoiceSent(invoice)) {
      bucket.invoicesSent += 1;
    }
    if (isCollectibleInvoiceStatus(invoice.status)) {
      addCurrencyAmount(
        bucket.valueInvoiced,
        invoice.currencyCode,
        invoice.invoiceTotal,
        invoice.decimalPrecision,
      );
    }
  }

  for (const payment of payments) {
    if (payment.status !== "SUCCESSFUL") {
      continue;
    }
    if (!payment.invoiceAssignedStaffUserId) {
      continue;
    }
    const bucket = ensureStaffBucket(
      buckets,
      payment.invoiceAssignedStaffUserId,
      payment.invoiceAssignedStaffName,
    );
    addCurrencyAmount(
      bucket.collections,
      payment.invoiceCurrencyCode,
      payment.invoiceAmountApplied,
      payment.invoiceDecimalPrecision,
    );
    bucket.collectionPaymentIds.add(payment.id);
  }

  return [...buckets.values()].map((bucket) => ({
    staffUserId: bucket.staffUserId,
    staffDisplayName: bucket.staffDisplayName,
    invoicesCreated: bucket.invoicesCreated,
    invoicesSent: bucket.invoicesSent,
    valueInvoiced: finalizeCurrencyBuckets(bucket.valueInvoiced),
    collections: finalizeCurrencyBuckets(bucket.collections),
    collectionsCount: bucket.collectionPaymentIds.size,
  }));
}

/**
 * Sort staff performance rows for report pagination.
 */
export function sortStaffPerformanceRows(
  rows: readonly StaffPerformanceRow[],
  sortBy: StaffPerformanceSortField,
  sortDir: StaffPerformanceSortDir,
): StaffPerformanceRow[] {
  const dir = sortDir === "desc" ? -1 : 1;
  const sorted = [...rows];
  sorted.sort((left, right) => {
    let cmp = 0;
    switch (sortBy) {
      case "invoicesCreated":
        cmp = left.invoicesCreated - right.invoicesCreated;
        break;
      case "invoicesSent":
        cmp = left.invoicesSent - right.invoicesSent;
        break;
      case "collectionsCount":
        cmp = left.collectionsCount - right.collectionsCount;
        break;
      case "staff":
      default:
        cmp = left.staffDisplayName.localeCompare(right.staffDisplayName);
        break;
    }
    if (cmp !== 0) {
      return cmp * dir;
    }
    return left.staffDisplayName.localeCompare(right.staffDisplayName);
  });
  return sorted;
}

/**
 * Paginate already-sorted staff performance rows.
 */
export function paginateStaffPerformanceRows(
  rows: readonly StaffPerformanceRow[],
  page: number,
  pageSize: number,
): { readonly rows: readonly StaffPerformanceRow[]; readonly totalCount: number } {
  const totalCount = rows.length;
  const start = Math.max(0, (page - 1) * pageSize);
  return {
    rows: rows.slice(start, start + pageSize),
    totalCount,
  };
}

/**
 * BR-013: each staff row must expose currency-scoped amounts only — no grandTotal.
 */
export function assertStaffPerformanceHasNoUnlabeledMixedTotal(
  rows: readonly StaffPerformanceRow[],
): void {
  if (!Array.isArray(rows)) {
    throw new Error("Staff performance must expose staff rows only.");
  }
  for (const row of rows) {
    if ("grandTotal" in row || "totalInvoiced" in row || "totalCollections" in row) {
      throw new Error("Staff performance must not expose an unlabeled mixed-currency total.");
    }
    for (const bucket of row.valueInvoiced) {
      if (!bucket.currencyCode || String(bucket.currencyCode).trim().length === 0) {
        throw new Error("Staff performance value-invoiced bucket missing currency code.");
      }
    }
    for (const bucket of row.collections) {
      if (!bucket.currencyCode || String(bucket.currencyCode).trim().length === 0) {
        throw new Error("Staff performance collections bucket missing currency code.");
      }
    }
  }
}

/**
 * TASK-084 / §13.3: do not invent staff commission.
 */
export function assertStaffPerformanceHasNoCommission(rows: readonly StaffPerformanceRow[]): void {
  for (const row of rows) {
    if (
      "commission" in row ||
      "commissionAmount" in row ||
      "commissionRate" in row ||
      "staffCommission" in row
    ) {
      throw new Error("Staff performance must not invent commission.");
    }
  }
}
