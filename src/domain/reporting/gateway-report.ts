import { moneyDecimal, normalizeCurrencyCode, toDecimalString } from "@/domain/money/decimal";
import { roundMoney } from "@/domain/money/round";
import type {
  GatewayReportRow,
  GatewayReportSortDir,
  GatewayReportSortField,
  GatewayReportSourcePayment,
  GatewayReportSourceRefund,
} from "@/domain/reporting/types";
import type { PaymentMethodCode } from "@/domain/settlement/types";

/**
 * Gateway Report domain helpers (TASK-085 / §13.3 / BR-013 / BR-020).
 * Aggregates by gateway (method) × settlement currency.
 * Converted settlement uses stored snapshots only; fees stay separate and are never deducted.
 */

type MutableBucket = {
  methodCode: PaymentMethodCode;
  settlementCurrencyCode: string;
  transactionCount: number;
  failureCount: number;
  convertedSettlement: ReturnType<typeof moneyDecimal>;
  processorFees: ReturnType<typeof moneyDecimal>;
  actualReceived: ReturnType<typeof moneyDecimal>;
  refundCount: number;
  refunds: ReturnType<typeof moneyDecimal>;
  settlementDecimalPrecision: number;
};

function bucketKey(methodCode: PaymentMethodCode, settlementCurrencyCode: string): string {
  return `${methodCode}:${normalizeCurrencyCode(settlementCurrencyCode)}`;
}

function emptyBucket(
  methodCode: PaymentMethodCode,
  settlementCurrencyCode: string,
  settlementDecimalPrecision: number,
): MutableBucket {
  return {
    methodCode,
    settlementCurrencyCode: normalizeCurrencyCode(settlementCurrencyCode),
    transactionCount: 0,
    failureCount: 0,
    convertedSettlement: moneyDecimal("0"),
    processorFees: moneyDecimal("0"),
    actualReceived: moneyDecimal("0"),
    refundCount: 0,
    refunds: moneyDecimal("0"),
    settlementDecimalPrecision,
  };
}

/**
 * Build one gateway report row per method × settlement currency from access-scoped sources.
 */
export function buildGatewayReportRows(
  payments: readonly GatewayReportSourcePayment[],
  refunds: readonly GatewayReportSourceRefund[],
): GatewayReportRow[] {
  const buckets = new Map<string, MutableBucket>();

  function ensureBucket(
    methodCode: PaymentMethodCode,
    settlementCurrencyCode: string,
    settlementDecimalPrecision: number,
  ): MutableBucket {
    const key = bucketKey(methodCode, settlementCurrencyCode);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = emptyBucket(methodCode, settlementCurrencyCode, settlementDecimalPrecision);
      buckets.set(key, bucket);
    }
    return bucket;
  }

  for (const payment of payments) {
    const bucket = ensureBucket(
      payment.methodCode,
      payment.settlementCurrencyCode,
      payment.settlementDecimalPrecision,
    );

    if (payment.status === "FAILED") {
      bucket.failureCount += 1;
      continue;
    }

    if (payment.status !== "SUCCESSFUL") {
      continue;
    }

    bucket.transactionCount += 1;

    const converted = roundMoney(
      moneyDecimal(payment.convertedSettlementAmount),
      payment.settlementDecimalPrecision,
    );
    // Fees are never subtracted from converted settlement (BR-020 / TASK-085 excluded).
    bucket.convertedSettlement = bucket.convertedSettlement.plus(converted);

    if (payment.processorFeeAmount != null) {
      const fee = roundMoney(
        moneyDecimal(payment.processorFeeAmount),
        payment.settlementDecimalPrecision,
      );
      bucket.processorFees = bucket.processorFees.plus(fee);
    }

    if (payment.actualReceivedAmount != null) {
      const received = roundMoney(
        moneyDecimal(payment.actualReceivedAmount),
        payment.settlementDecimalPrecision,
      );
      bucket.actualReceived = bucket.actualReceived.plus(received);
    }
  }

  for (const refund of refunds) {
    const bucket = ensureBucket(
      refund.methodCode,
      refund.settlementCurrencyCode,
      refund.settlementDecimalPrecision,
    );
    bucket.refundCount += 1;
    const amount = roundMoney(moneyDecimal(refund.refundAmount), refund.settlementDecimalPrecision);
    bucket.refunds = bucket.refunds.plus(amount);
  }

  return [...buckets.values()]
    .map((bucket) => ({
      methodCode: bucket.methodCode,
      settlementCurrencyCode: bucket.settlementCurrencyCode,
      transactionCount: bucket.transactionCount,
      failureCount: bucket.failureCount,
      convertedSettlement: toDecimalString(
        roundMoney(bucket.convertedSettlement, bucket.settlementDecimalPrecision),
      ),
      processorFees: toDecimalString(
        roundMoney(bucket.processorFees, bucket.settlementDecimalPrecision),
      ),
      actualReceived: toDecimalString(
        roundMoney(bucket.actualReceived, bucket.settlementDecimalPrecision),
      ),
      refundCount: bucket.refundCount,
      refunds: toDecimalString(roundMoney(bucket.refunds, bucket.settlementDecimalPrecision)),
      settlementDecimalPrecision: bucket.settlementDecimalPrecision,
    }))
    .sort((left, right) => {
      const methodCmp = left.methodCode.localeCompare(right.methodCode);
      if (methodCmp !== 0) {
        return methodCmp;
      }
      return left.settlementCurrencyCode.localeCompare(right.settlementCurrencyCode);
    });
}

/**
 * Sort gateway report rows for report pagination.
 */
export function sortGatewayReportRows(
  rows: readonly GatewayReportRow[],
  sortBy: GatewayReportSortField,
  sortDir: GatewayReportSortDir,
): GatewayReportRow[] {
  const dir = sortDir === "desc" ? -1 : 1;
  const sorted = [...rows];
  sorted.sort((left, right) => {
    let cmp = 0;
    switch (sortBy) {
      case "settlementCurrency":
        cmp = left.settlementCurrencyCode.localeCompare(right.settlementCurrencyCode);
        break;
      case "transactionCount":
        cmp = left.transactionCount - right.transactionCount;
        break;
      case "failureCount":
        cmp = left.failureCount - right.failureCount;
        break;
      case "convertedSettlement":
        cmp = moneyDecimal(left.convertedSettlement).comparedTo(
          moneyDecimal(right.convertedSettlement),
        );
        break;
      case "refunds":
        cmp = moneyDecimal(left.refunds).comparedTo(moneyDecimal(right.refunds));
        break;
      case "gateway":
      default:
        cmp = left.methodCode.localeCompare(right.methodCode);
        break;
    }
    if (cmp !== 0) {
      return cmp * dir;
    }
    const methodCmp = left.methodCode.localeCompare(right.methodCode);
    if (methodCmp !== 0) {
      return methodCmp;
    }
    return left.settlementCurrencyCode.localeCompare(right.settlementCurrencyCode);
  });
  return sorted;
}

/**
 * Paginate already-sorted gateway report rows.
 */
export function paginateGatewayReportRows(
  rows: readonly GatewayReportRow[],
  page: number,
  pageSize: number,
): { readonly rows: readonly GatewayReportRow[]; readonly totalCount: number } {
  const totalCount = rows.length;
  const start = Math.max(0, (page - 1) * pageSize);
  return {
    rows: rows.slice(start, start + pageSize),
    totalCount,
  };
}

/**
 * BR-013: each row must be keyed by gateway × settlement currency — no grandTotal.
 */
export function assertGatewayReportHasNoUnlabeledMixedTotal(
  rows: readonly GatewayReportRow[],
): void {
  if (!Array.isArray(rows)) {
    throw new Error("Gateway report must expose gateway rows only.");
  }
  for (const row of rows) {
    if ("grandTotal" in row || "totalSettlement" in row) {
      throw new Error("Gateway report must not expose an unlabeled mixed-currency total.");
    }
    if (!row.settlementCurrencyCode || String(row.settlementCurrencyCode).trim().length === 0) {
      throw new Error("Gateway report row missing settlement currency code.");
    }
    if (!row.methodCode || String(row.methodCode).trim().length === 0) {
      throw new Error("Gateway report row missing gateway method code.");
    }
  }
}

/**
 * BR-020 / TASK-085 excluded: fees must never alter converted settlement totals.
 */
export function assertGatewayReportFeesSeparateFromSettlement(
  rows: readonly GatewayReportRow[],
  payments: readonly GatewayReportSourcePayment[],
): void {
  for (const row of rows) {
    const matching = payments.filter(
      (payment) =>
        payment.methodCode === row.methodCode &&
        normalizeCurrencyCode(payment.settlementCurrencyCode) === row.settlementCurrencyCode &&
        payment.status === "SUCCESSFUL",
    );
    let expectedSettlement = moneyDecimal("0");
    for (const payment of matching) {
      expectedSettlement = expectedSettlement.plus(
        roundMoney(
          moneyDecimal(payment.convertedSettlementAmount),
          payment.settlementDecimalPrecision,
        ),
      );
    }
    const expected = toDecimalString(
      roundMoney(expectedSettlement, row.settlementDecimalPrecision),
    );
    if (row.convertedSettlement !== expected) {
      throw new Error(
        "Gateway report converted settlement must equal stored snapshots without deducting fees.",
      );
    }
  }
}
