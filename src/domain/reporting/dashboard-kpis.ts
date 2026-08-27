import { isCollectibleInvoiceStatus } from "@/domain/invoices/cancellation";
import { invoiceMeetsOverdueRule } from "@/domain/invoices/lifecycle";
import { moneyDecimal, normalizeCurrencyCode, toDecimalString } from "@/domain/money/decimal";
import { roundMoney } from "@/domain/money/round";
import type {
  DashboardInvoiceCurrencyKpis,
  DashboardInvoiceRow,
  DashboardKpiPayload,
  DashboardMethodStatusCount,
  DashboardPaymentRow,
  DashboardSettlementCurrencyKpis,
  DashboardStatusCount,
} from "@/domain/reporting/types";
import type { PaymentMethodCode } from "@/domain/settlement/types";
import type { PaymentStatus } from "@/domain/payments/types";

/**
 * Pure dashboard KPI aggregation (TASK-077 / Dashboard §13.1).
 * - Invoice totals stay in original currencies (BR-013).
 * - Converted settlement uses stored payment snapshots only.
 * - Processor fees / actual received are separate and never deducted from settlement (BR-020).
 */

export type BuildDashboardKpisOptions = {
  /** Reference instant for overdue (defaults to now). */
  readonly asOf?: Date;
};

type MutableInvoiceBucket = {
  currencyCode: string;
  totalInvoiced: ReturnType<typeof moneyDecimal>;
  totalPaid: ReturnType<typeof moneyDecimal>;
  outstanding: ReturnType<typeof moneyDecimal>;
  overdue: ReturnType<typeof moneyDecimal>;
  decimalPrecision: number;
};

type MutableSettlementBucket = {
  currencyCode: string;
  convertedSettlement: ReturnType<typeof moneyDecimal>;
  processorFees: ReturnType<typeof moneyDecimal>;
  actualReceived: ReturnType<typeof moneyDecimal>;
  decimalPrecision: number;
};

function emptyInvoiceBucket(currencyCode: string, decimalPrecision: number): MutableInvoiceBucket {
  return {
    currencyCode,
    totalInvoiced: moneyDecimal("0"),
    totalPaid: moneyDecimal("0"),
    outstanding: moneyDecimal("0"),
    overdue: moneyDecimal("0"),
    decimalPrecision,
  };
}

function emptySettlementBucket(
  currencyCode: string,
  decimalPrecision: number,
): MutableSettlementBucket {
  return {
    currencyCode,
    convertedSettlement: moneyDecimal("0"),
    processorFees: moneyDecimal("0"),
    actualReceived: moneyDecimal("0"),
    decimalPrecision,
  };
}

/**
 * Aggregate dashboard KPI cards from access-scoped invoice and payment rows.
 */
export function buildDashboardKpis(
  invoices: readonly DashboardInvoiceRow[],
  payments: readonly DashboardPaymentRow[],
  options: BuildDashboardKpisOptions = {},
): DashboardKpiPayload {
  const asOf = options.asOf ?? new Date();
  const invoiceBuckets = new Map<string, MutableInvoiceBucket>();
  const settlementBuckets = new Map<string, MutableSettlementBucket>();
  const invoiceStatusCounts = new Map<string, number>();
  const paymentMethodStatusCounts = new Map<string, DashboardMethodStatusCount>();

  for (const invoice of invoices) {
    const statusKey = invoice.status;
    invoiceStatusCounts.set(statusKey, (invoiceStatusCounts.get(statusKey) ?? 0) + 1);

    if (!isCollectibleInvoiceStatus(invoice.status)) {
      continue;
    }

    const currencyCode = normalizeCurrencyCode(invoice.currencyCode);
    let bucket = invoiceBuckets.get(currencyCode);
    if (!bucket) {
      bucket = emptyInvoiceBucket(currencyCode, invoice.decimalPrecision);
      invoiceBuckets.set(currencyCode, bucket);
    }

    const invoiced = roundMoney(moneyDecimal(invoice.invoiceTotal), invoice.decimalPrecision);
    const outstanding = roundMoney(
      moneyDecimal(invoice.outstandingAmount),
      invoice.decimalPrecision,
    );

    bucket.totalInvoiced = bucket.totalInvoiced.plus(invoiced);
    bucket.outstanding = bucket.outstanding.plus(outstanding);

    if (
      invoiceMeetsOverdueRule(
        {
          status: invoice.status,
          dueDate: invoice.dueDate,
          outstandingAmount: invoice.outstandingAmount,
        },
        asOf,
      )
    ) {
      bucket.overdue = bucket.overdue.plus(outstanding);
    }
  }

  for (const payment of payments) {
    const methodKey = `${payment.methodCode}:${payment.status}`;
    const existingCount = paymentMethodStatusCounts.get(methodKey);
    if (existingCount) {
      paymentMethodStatusCounts.set(methodKey, {
        ...existingCount,
        count: existingCount.count + 1,
      });
    } else {
      paymentMethodStatusCounts.set(methodKey, {
        methodCode: payment.methodCode,
        status: payment.status,
        count: 1,
      });
    }

    if (payment.status !== "SUCCESSFUL") {
      continue;
    }

    const invoiceCurrency = normalizeCurrencyCode(payment.invoiceCurrencyCode);
    let invoiceBucket = invoiceBuckets.get(invoiceCurrency);
    if (!invoiceBucket) {
      invoiceBucket = emptyInvoiceBucket(invoiceCurrency, payment.invoiceDecimalPrecision);
      invoiceBuckets.set(invoiceCurrency, invoiceBucket);
    }
    const paid = roundMoney(
      moneyDecimal(payment.invoiceAmountApplied),
      payment.invoiceDecimalPrecision,
    );
    invoiceBucket.totalPaid = invoiceBucket.totalPaid.plus(paid);

    const settlementCurrency = normalizeCurrencyCode(payment.settlementCurrencyCode);
    let settlementBucket = settlementBuckets.get(settlementCurrency);
    if (!settlementBucket) {
      settlementBucket = emptySettlementBucket(
        settlementCurrency,
        payment.settlementDecimalPrecision,
      );
      settlementBuckets.set(settlementCurrency, settlementBucket);
    }

    const converted = roundMoney(
      moneyDecimal(payment.convertedSettlementAmount),
      payment.settlementDecimalPrecision,
    );
    // Fees are never subtracted from converted settlement (BR-020).
    settlementBucket.convertedSettlement = settlementBucket.convertedSettlement.plus(converted);

    if (payment.processorFeeAmount != null) {
      const fee = roundMoney(
        moneyDecimal(payment.processorFeeAmount),
        payment.settlementDecimalPrecision,
      );
      settlementBucket.processorFees = settlementBucket.processorFees.plus(fee);
    }

    if (payment.actualReceivedAmount != null) {
      const received = roundMoney(
        moneyDecimal(payment.actualReceivedAmount),
        payment.settlementDecimalPrecision,
      );
      settlementBucket.actualReceived = settlementBucket.actualReceived.plus(received);
    }
  }

  const invoiceCurrencies: DashboardInvoiceCurrencyKpis[] = [...invoiceBuckets.values()]
    .sort((a, b) => a.currencyCode.localeCompare(b.currencyCode))
    .map((bucket) => ({
      currencyCode: bucket.currencyCode,
      totalInvoiced: toDecimalString(roundMoney(bucket.totalInvoiced, bucket.decimalPrecision)),
      totalPaid: toDecimalString(roundMoney(bucket.totalPaid, bucket.decimalPrecision)),
      outstanding: toDecimalString(roundMoney(bucket.outstanding, bucket.decimalPrecision)),
      overdue: toDecimalString(roundMoney(bucket.overdue, bucket.decimalPrecision)),
    }));

  const settlementCurrencies: DashboardSettlementCurrencyKpis[] = [...settlementBuckets.values()]
    .sort((a, b) => a.currencyCode.localeCompare(b.currencyCode))
    .map((bucket) => ({
      currencyCode: bucket.currencyCode,
      convertedSettlement: toDecimalString(
        roundMoney(bucket.convertedSettlement, bucket.decimalPrecision),
      ),
      processorFees: toDecimalString(roundMoney(bucket.processorFees, bucket.decimalPrecision)),
      actualReceived: toDecimalString(roundMoney(bucket.actualReceived, bucket.decimalPrecision)),
    }));

  const invoiceCountsByStatus: DashboardStatusCount[] = [...invoiceStatusCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([status, count]) => ({ status, count }));

  const paymentCountsByMethodStatus: DashboardMethodStatusCount[] = [
    ...paymentMethodStatusCounts.values(),
  ].sort((a, b) => {
    const methodCmp = a.methodCode.localeCompare(b.methodCode);
    if (methodCmp !== 0) {
      return methodCmp;
    }
    return a.status.localeCompare(b.status);
  });

  return {
    invoiceCurrencies,
    settlementCurrencies,
    invoiceCountsByStatus,
    paymentCountsByMethodStatus,
  };
}

/**
 * BR-013: dashboard payload must expose currency-scoped buckets only — no grandTotal.
 */
export function assertDashboardHasNoUnlabeledMixedTotal(payload: DashboardKpiPayload): void {
  if (!Array.isArray(payload.invoiceCurrencies) || !Array.isArray(payload.settlementCurrencies)) {
    throw new Error("Dashboard KPIs must expose by-currency buckets only.");
  }
  if ("grandTotal" in payload || "totalInvoiced" in payload) {
    throw new Error("Dashboard KPIs must not expose an unlabeled mixed-currency total.");
  }
}

/**
 * BR-020: converted settlement must equal the sum of stored snapshots; fees are separate.
 */
export function assertFeesNotDeductedFromSettlement(input: {
  readonly convertedSettlementAmounts: readonly string[];
  readonly processorFeeAmounts: readonly (string | null)[];
  readonly reportedConvertedSettlement: string;
  readonly reportedProcessorFees: string;
  readonly decimalPrecision: number;
}): void {
  const expectedSettlement = input.convertedSettlementAmounts.reduce(
    (sum, amount) => sum.plus(roundMoney(moneyDecimal(amount), input.decimalPrecision)),
    moneyDecimal("0"),
  );
  const expectedFees = input.processorFeeAmounts.reduce((sum, amount) => {
    if (amount == null) {
      return sum;
    }
    return sum.plus(roundMoney(moneyDecimal(amount), input.decimalPrecision));
  }, moneyDecimal("0"));

  const reportedSettlement = moneyDecimal(input.reportedConvertedSettlement);
  const reportedFees = moneyDecimal(input.reportedProcessorFees);

  if (!reportedSettlement.equals(roundMoney(expectedSettlement, input.decimalPrecision))) {
    throw new Error("Converted settlement must equal stored snapshots without fee deduction.");
  }
  if (!reportedFees.equals(roundMoney(expectedFees, input.decimalPrecision))) {
    throw new Error("Processor fees must be aggregated separately from converted settlement.");
  }
  // Explicitly reject settlement-minus-fee as the "settlement" figure.
  const wronglyNet = expectedSettlement.minus(expectedFees);
  if (
    expectedFees.gt(0) &&
    reportedSettlement.equals(roundMoney(wronglyNet, input.decimalPrecision))
  ) {
    throw new Error("Converted settlement must not net out processor fees.");
  }
}

export type { PaymentMethodCode, PaymentStatus };
