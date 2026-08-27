import { invoiceMeetsOverdueRule } from "@/domain/invoices/lifecycle";
import type { InvoiceStatus } from "@/domain/invoices/types";
import { moneyDecimal, normalizeCurrencyCode, toDecimalString } from "@/domain/money/decimal";
import { roundMoney } from "@/domain/money/round";
import { computeOutstandingAgeDays } from "@/domain/reporting/outstanding-report";
import {
  OVERDUE_AGING_BUCKET_IDS,
  type OverdueAgingBucketId,
  type OverdueAgingBucketSummary,
  type OverdueAgingCurrencyTotal,
  type OverdueAgingPayload,
  type OverdueAgingSourceInvoice,
} from "@/domain/reporting/types";

/**
 * Overdue Aging Report domain helpers (TASK-081 / §13.3 / BR-018).
 * Buckets: 1-30, 31-60, 61-90, 90+ (days past due).
 * Eligible: issued/partial/overdue with balance > 0 and due date in the past.
 * Draft and paid/cancelled are never aged here.
 */

export { OVERDUE_AGING_BUCKET_IDS };

export const OVERDUE_AGING_BUCKET_LABELS: Record<OverdueAgingBucketId, string> = {
  "1-30": "1–30 days",
  "31-60": "31–60 days",
  "61-90": "61–90 days",
  "90+": "90+ days",
};

/**
 * Map days past due to an aging bucket.
 * Age 0 (not yet past due) → null (not overdue).
 * 90+ means strictly more than 90 days (91+); 61–90 includes day 90.
 */
export function assignOverdueAgingBucket(ageDays: number): OverdueAgingBucketId | null {
  if (!Number.isFinite(ageDays) || ageDays < 1) {
    return null;
  }
  if (ageDays <= 30) {
    return "1-30";
  }
  if (ageDays <= 60) {
    return "31-60";
  }
  if (ageDays <= 90) {
    return "61-90";
  }
  return "90+";
}

/**
 * BR-018 overdue eligibility for aging: past due + open balance + issued/partial/overdue.
 * Draft never qualifies (TASK-081 excluded).
 */
export function isOverdueAgingEligible(
  invoice: {
    readonly status: InvoiceStatus;
    readonly dueDate: Date;
    readonly outstandingAmount: string;
  },
  asOf: Date = new Date(),
): boolean {
  return invoiceMeetsOverdueRule(invoice, asOf);
}

type MutableCurrencyBucket = {
  currencyCode: string;
  outstandingAmount: ReturnType<typeof moneyDecimal>;
  invoiceCount: number;
  decimalPrecision: number;
};

function emptyBucketSummaries(): Map<OverdueAgingBucketId, Map<string, MutableCurrencyBucket>> {
  const map = new Map<OverdueAgingBucketId, Map<string, MutableCurrencyBucket>>();
  for (const id of OVERDUE_AGING_BUCKET_IDS) {
    map.set(id, new Map());
  }
  return map;
}

function toCurrencyTotals(
  currencyMap: Map<string, MutableCurrencyBucket>,
): OverdueAgingCurrencyTotal[] {
  return [...currencyMap.values()]
    .sort((a, b) => a.currencyCode.localeCompare(b.currencyCode))
    .map((bucket) => ({
      currencyCode: bucket.currencyCode,
      outstandingAmount: toDecimalString(
        roundMoney(bucket.outstandingAmount, bucket.decimalPrecision),
      ),
      invoiceCount: bucket.invoiceCount,
      decimalPrecision: bucket.decimalPrecision,
    }));
}

function toBucketSummary(
  bucketId: OverdueAgingBucketId,
  currencyMap: Map<string, MutableCurrencyBucket>,
): OverdueAgingBucketSummary {
  const currencies = toCurrencyTotals(currencyMap);
  return {
    bucket: bucketId,
    label: OVERDUE_AGING_BUCKET_LABELS[bucketId],
    currencies,
    invoiceCount: currencies.reduce((sum, row) => sum + row.invoiceCount, 0),
  };
}

/**
 * Aggregate overdue invoices into aging buckets by invoice currency (BR-013).
 * Does not invent a reporting-currency rollup (ADR-011 OPEN).
 */
export function buildOverdueAgingReport(
  invoices: readonly OverdueAgingSourceInvoice[],
  asOf: Date = new Date(),
): OverdueAgingPayload {
  const buckets = emptyBucketSummaries();

  for (const invoice of invoices) {
    if (
      !isOverdueAgingEligible(
        {
          status: invoice.status,
          dueDate: invoice.dueDate,
          outstandingAmount: invoice.outstandingAmount,
        },
        asOf,
      )
    ) {
      continue;
    }

    const ageDays = computeOutstandingAgeDays(invoice.dueDate, asOf);
    const bucketId = assignOverdueAgingBucket(ageDays);
    if (!bucketId) {
      continue;
    }

    const currencyCode = normalizeCurrencyCode(invoice.currencyCode);
    const currencyMap = buckets.get(bucketId)!;
    let currencyBucket = currencyMap.get(currencyCode);
    if (!currencyBucket) {
      currencyBucket = {
        currencyCode,
        outstandingAmount: moneyDecimal("0"),
        invoiceCount: 0,
        decimalPrecision: invoice.decimalPrecision,
      };
      currencyMap.set(currencyCode, currencyBucket);
    }

    const outstanding = roundMoney(
      moneyDecimal(invoice.outstandingAmount),
      invoice.decimalPrecision,
    );
    currencyBucket.outstandingAmount = currencyBucket.outstandingAmount.plus(outstanding);
    currencyBucket.invoiceCount += 1;
  }

  return {
    asOf: asOf.toISOString().slice(0, 10),
    buckets: OVERDUE_AGING_BUCKET_IDS.map((id) => toBucketSummary(id, buckets.get(id)!)),
  };
}
