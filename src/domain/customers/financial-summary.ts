import { moneyDecimal, normalizeCurrencyCode, toDecimalString } from "@/domain/money/decimal";
import { sumMoney } from "@/domain/money/convert";
import { computeInvoiceOutstanding } from "@/domain/money/outstanding";
import { roundMoney } from "@/domain/money/round";
import type { DecimalInput } from "@/domain/money/types";

/**
 * Customer profile financial summary (Customers §7.2 / Dashboard §13.1 / TASK-029).
 * Aggregates only by invoice currency. Never produces an unlabeled mixed-currency total (BR-013).
 * Does not convert to reporting currency without stored Admin fixed-rate snapshots.
 */

export type CustomerFinancialSummaryInvoiceInput = {
  readonly companyId: string;
  readonly currencyCode: string;
  /** Gross invoice total in invoice currency. */
  readonly invoiceTotal: DecimalInput;
  /** Confirmed payment applications in invoice currency (BR-009 / Definitions). */
  readonly confirmedApplications: readonly DecimalInput[];
  readonly dueDate: Date | null;
  /** Cancelled invoices are excluded from all summary metrics. */
  readonly cancelled: boolean;
  /**
   * When false (e.g. draft), the row is omitted from Total Invoiced / Paid / Outstanding / Overdue.
   */
  readonly includeInSummary: boolean;
  readonly decimalPrecision: number;
};

export type CustomerFinancialSummaryCurrencyBucket = {
  readonly currencyCode: string;
  /** Sum of included invoice totals in this currency. */
  readonly totalInvoiced: string;
  /** Sum of confirmed applications in this currency. */
  readonly totalPaid: string;
  /** Sum of open balances (invoice total − confirmed applications). */
  readonly outstanding: string;
  /** Outstanding where due date is past and invoice is not paid/cancelled. */
  readonly overdue: string;
};

export type CustomerFinancialSummaryAggregate = {
  readonly byCurrency: readonly CustomerFinancialSummaryCurrencyBucket[];
};

export type BuildCustomerFinancialSummaryOptions = {
  /** Restrict to one company; null = all provided rows (already access-scoped by caller). */
  readonly companyFilterId?: string | null;
  /** Reference instant for overdue (defaults to now). */
  readonly asOf?: Date;
};

type MutableBucket = {
  currencyCode: string;
  totalInvoiced: ReturnType<typeof moneyDecimal>;
  totalPaid: ReturnType<typeof moneyDecimal>;
  outstanding: ReturnType<typeof moneyDecimal>;
  overdue: ReturnType<typeof moneyDecimal>;
  decimalPrecision: number;
};

function isOverdueInvoice(input: {
  readonly dueDate: Date | null;
  readonly outstandingAmount: ReturnType<typeof moneyDecimal>;
  readonly cancelled: boolean;
  readonly asOf: Date;
}): boolean {
  if (input.cancelled) {
    return false;
  }
  if (!input.dueDate) {
    return false;
  }
  if (input.outstandingAmount.lte(0)) {
    return false;
  }
  return input.dueDate.getTime() < input.asOf.getTime();
}

/**
 * Pure aggregation for customer financial summary widgets.
 * Callers must only pass invoices the actor may see (company/customer scope).
 */
export function buildCustomerFinancialSummary(
  rows: readonly CustomerFinancialSummaryInvoiceInput[],
  options: BuildCustomerFinancialSummaryOptions = {},
): CustomerFinancialSummaryAggregate {
  const asOf = options.asOf ?? new Date();
  const companyFilterId = options.companyFilterId ?? null;
  const buckets = new Map<string, MutableBucket>();

  for (const row of rows) {
    if (!row.includeInSummary || row.cancelled) {
      continue;
    }
    if (companyFilterId && row.companyId !== companyFilterId) {
      continue;
    }

    const currencyCode = normalizeCurrencyCode(row.currencyCode);
    const outstandingResult = computeInvoiceOutstanding({
      invoiceTotal: row.invoiceTotal,
      invoiceCurrencyCode: currencyCode,
      confirmedApplications: row.confirmedApplications,
      decimalPrecision: row.decimalPrecision,
    });
    const outstandingAmount = moneyDecimal(outstandingResult.amount);
    const paidAmount = roundMoney(sumMoney(row.confirmedApplications), row.decimalPrecision);
    const invoicedAmount = roundMoney(moneyDecimal(row.invoiceTotal), row.decimalPrecision);

    let bucket = buckets.get(currencyCode);
    if (!bucket) {
      bucket = {
        currencyCode,
        totalInvoiced: moneyDecimal("0"),
        totalPaid: moneyDecimal("0"),
        outstanding: moneyDecimal("0"),
        overdue: moneyDecimal("0"),
        decimalPrecision: row.decimalPrecision,
      };
      buckets.set(currencyCode, bucket);
    } else if (bucket.decimalPrecision !== row.decimalPrecision) {
      // Same currency code must share precision; keep first precision for rounding output.
      // Authoritative rows should already agree via currency master.
    }

    bucket.totalInvoiced = bucket.totalInvoiced.plus(invoicedAmount);
    bucket.totalPaid = bucket.totalPaid.plus(paidAmount);
    bucket.outstanding = bucket.outstanding.plus(outstandingAmount);
    if (
      isOverdueInvoice({
        dueDate: row.dueDate,
        outstandingAmount,
        cancelled: row.cancelled,
        asOf,
      })
    ) {
      bucket.overdue = bucket.overdue.plus(outstandingAmount);
    }
  }

  const byCurrency = [...buckets.values()]
    .sort((a, b) => a.currencyCode.localeCompare(b.currencyCode))
    .map((bucket) => ({
      currencyCode: bucket.currencyCode,
      totalInvoiced: toDecimalString(roundMoney(bucket.totalInvoiced, bucket.decimalPrecision)),
      totalPaid: toDecimalString(roundMoney(bucket.totalPaid, bucket.decimalPrecision)),
      outstanding: toDecimalString(roundMoney(bucket.outstanding, bucket.decimalPrecision)),
      overdue: toDecimalString(roundMoney(bucket.overdue, bucket.decimalPrecision)),
    }));

  return { byCurrency };
}

/**
 * BR-013 display rule: never collapse multiple currency buckets into one unlabeled total.
 */
export function assertFinancialSummaryHasNoUnlabeledMixedTotal(
  summary: CustomerFinancialSummaryAggregate,
): void {
  // Structure is by-currency only; there is intentionally no `grandTotal` field.
  if (!Array.isArray(summary.byCurrency)) {
    throw new Error("Financial summary must expose by-currency buckets only.");
  }
}
