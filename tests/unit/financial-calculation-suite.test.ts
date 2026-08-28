import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { Decimal } from "@prisma/client/runtime/client";
import { describe, expect, it } from "vitest";

import { resolveChargebackDebitLossAmounts } from "@/domain/chargebacks/invariants";
import { selectEffectiveRate } from "@/domain/fixed-rates/resolve-rate";
import {
  computeInvoicePaymentAllocation,
  deriveInvoiceStatusFromPayments,
} from "@/domain/invoices/allocation";
import { evaluateOverdueStatus, invoiceMeetsOverdueRule } from "@/domain/invoices/lifecycle";
import { formatInvoiceNumber, rejectHandEditedInvoiceNumber } from "@/domain/invoices/numbering";
import {
  computeConvertedSettlementAmount,
  computeCbrf,
  computeGrossReceipts,
  computeInvoiceOutstanding,
  computeNetGTotal,
  computeReportingNetTotals,
  moneyDecimal,
  sumMoney,
} from "@/domain/money";
import {
  confirmSnapshotLock,
  isConversionSnapshotComplete,
  isCrossCurrencyPayment,
} from "@/domain/payments/snapshot";
import {
  resolveFullRefundAmounts,
  resolvePartialRefundAmounts,
  resolveRefundSettlementAmount,
} from "@/domain/refunds/invariants";
import {
  adjustmentRow,
  crossCurrencyPayment,
  gbpUsdRateV1,
  gbpUsdRateV2,
  GBP_USD_RATE_V1,
  GBP_USD_RATE_V2,
} from "../helpers/financial-calculation-fixtures";

function walkFiles(directory: string, predicate: (file: string) => boolean): string[] {
  if (!existsSync(directory)) {
    return [];
  }

  const entries = readdirSync(directory);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...walkFiles(fullPath, predicate));
      continue;
    }
    if (predicate(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

function uncommented(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
}

/** Assert monetary equality via Prisma Decimal — never JS float compare. */
function expectMoneyEqual(actual: string, expected: string): void {
  expect(moneyDecimal(actual).equals(moneyDecimal(expected))).toBe(true);
}

describe("financial calculation suite (TASK-094)", () => {
  describe("authoritative Decimal boundary (ADR-004)", () => {
    it("rejects JavaScript numbers for authoritative money", () => {
      expect(() => moneyDecimal(0.1 as unknown as string)).toThrow(/JavaScript number/);
    });

    it("sums fractional decimal strings without float drift", () => {
      const total = sumMoney(["0.1", "0.2"]);
      expect(total.equals(new Decimal("0.3"))).toBe(true);
      expect(total.toString()).toBe("0.3");
      expect(total.toString()).not.toBe(String(0.1 + 0.2));
    });
  });

  describe("financial domain source boundary", () => {
    const financialRoots = [
      path.join(process.cwd(), "src", "domain", "money"),
      path.join(process.cwd(), "src", "domain", "invoices", "allocation.ts"),
      path.join(process.cwd(), "src", "domain", "invoices", "lifecycle.ts"),
      path.join(process.cwd(), "src", "domain", "payments", "snapshot.ts"),
      path.join(process.cwd(), "src", "domain", "payments", "reconciliation.ts"),
      path.join(process.cwd(), "src", "domain", "refunds", "invariants.ts"),
      path.join(process.cwd(), "src", "domain", "chargebacks", "invariants.ts"),
      path.join(process.cwd(), "src", "domain", "fixed-rates", "resolve-rate.ts"),
    ];

    it("does not use parseFloat in authoritative financial domain code", () => {
      const offenders: string[] = [];

      for (const root of financialRoots) {
        const files = statSync(root).isDirectory()
          ? walkFiles(root, (file) => file.endsWith(".ts"))
          : [root];

        for (const file of files) {
          const source = uncommented(readFileSync(file, "utf8"));
          if (source.includes("parseFloat(")) {
            offenders.push(path.relative(process.cwd(), file));
          }
        }
      }

      expect(offenders).toEqual([]);
    });
  });

  describe("BR-020 — fees never affect conversion, outstanding, or CB/RF", () => {
    it("keeps converted settlement independent of processor fee", () => {
      const base = computeConvertedSettlementAmount({
        invoiceAmountApplied: "100.00",
        invoiceCurrencyCode: "GBP",
        settlementCurrencyCode: "USD",
        fixedConversionRate: GBP_USD_RATE_V1,
        settlementDecimalPrecision: 2,
      });
      const withFee = computeConvertedSettlementAmount({
        invoiceAmountApplied: "100.00",
        invoiceCurrencyCode: "GBP",
        settlementCurrencyCode: "USD",
        fixedConversionRate: GBP_USD_RATE_V1,
        settlementDecimalPrecision: 2,
        processorFee: "9.99",
      });
      expect(withFee.convertedSettlementAmount.amount).toBe("125");
      expect(withFee.convertedSettlementAmount.amount).toBe(base.convertedSettlementAmount.amount);
    });

    it("keeps invoice outstanding independent of fee and actual received", () => {
      const withoutFee = computeInvoiceOutstanding({
        invoiceTotal: "250.00",
        invoiceCurrencyCode: "GBP",
        confirmedApplications: ["100.00"],
        decimalPrecision: 2,
      });
      const withFee = computeInvoiceOutstanding({
        invoiceTotal: "250.00",
        invoiceCurrencyCode: "GBP",
        confirmedApplications: ["100.00"],
        decimalPrecision: 2,
        processorFee: "9.99",
        actualReceivedAmount: "115.01",
      });
      expect(withFee.amount).toBe(withoutFee.amount);
      expect(withFee.amount).toBe("150");
    });

    it("excludes processor fees from CB/RF totals", () => {
      const withoutFees = computeCbrf({
        adjustments: [{ type: "REFUND", status: "PROCESSED", amount: "40.00" }],
        currencyCode: "USD",
        decimalPrecision: 2,
      });
      const withFees = computeCbrf({
        adjustments: [{ type: "REFUND", status: "PROCESSED", amount: "40.00" }],
        currencyCode: "USD",
        decimalPrecision: 2,
        processorFees: ["12.50", "3.00"],
      });
      expect(withFees.amount).toBe(withoutFees.amount);
      expect(withFees.amount).toBe("40");
    });
  });

  describe("BR-021 — historical snapshots never recalculated", () => {
    it("preserves stored payment conversion when a newer Admin rate activates", () => {
      const paymentDate = new Date("2026-03-15T00:00:00.000Z");
      const atPayment = selectEffectiveRate(
        [gbpUsdRateV1, gbpUsdRateV2],
        "GBP",
        "USD",
        paymentDate,
      );
      expect(atPayment.ok).toBe(true);
      if (!atPayment.ok) {
        throw new Error("expected rate at payment");
      }
      expect(atPayment.fixedRate).toBe(GBP_USD_RATE_V1);

      const afterRateChange = selectEffectiveRate(
        [gbpUsdRateV1, gbpUsdRateV2],
        "GBP",
        "USD",
        new Date("2026-08-01T00:00:00.000Z"),
      );
      expect(afterRateChange.ok).toBe(true);
      if (!afterRateChange.ok) {
        throw new Error("expected rate after change");
      }
      expect(afterRateChange.fixedRate).toBe(GBP_USD_RATE_V2);

      const locked = crossCurrencyPayment();
      const recomputedWithNewRate = computeConvertedSettlementAmount({
        invoiceAmountApplied: locked.invoiceAmountApplied,
        invoiceCurrencyCode: locked.invoiceCurrencyCode,
        settlementCurrencyCode: locked.settlementCurrencyCode,
        fixedConversionRate: afterRateChange.fixedRate,
        settlementDecimalPrecision: 2,
      });
      expect(recomputedWithNewRate.convertedSettlementAmount.amount).toBe("128");
      expectMoneyEqual(locked.convertedSettlementAmount, "125.00");
      expect(locked.fixedConversionRate).toBe(GBP_USD_RATE_V1);
    });

    it("does not replace stored snapshot metadata when completing the lock", () => {
      const stored = crossCurrencyPayment();
      const fill = confirmSnapshotLock(stored, {
        rateEffectiveAt: new Date("2026-12-01T00:00:00.000Z"),
        rateVersionId: gbpUsdRateV2.id,
      });
      expect(fill.rateVersionId).toBe(stored.rateVersionId);
      expect(fill.rateEffectiveAt?.toISOString()).toBe(stored.rateEffectiveAt?.toISOString());
    });
  });

  describe("BR-022 — rate version selected by effective date/time", () => {
    it("selects the version covering the transaction timestamp", () => {
      const beforeChange = selectEffectiveRate(
        [gbpUsdRateV1, gbpUsdRateV2],
        "GBP",
        "USD",
        new Date("2026-06-30T23:59:59.999Z"),
      );
      expect(beforeChange.ok).toBe(true);
      if (!beforeChange.ok) {
        throw new Error("expected v1");
      }
      expect(beforeChange.rateVersionId).toBe(gbpUsdRateV1.id);
      expect(beforeChange.fixedRate).toBe(GBP_USD_RATE_V1);

      const afterChange = selectEffectiveRate(
        [gbpUsdRateV1, gbpUsdRateV2],
        "GBP",
        "USD",
        new Date("2026-07-01T00:00:00.000Z"),
      );
      expect(afterChange.ok).toBe(true);
      if (!afterChange.ok) {
        throw new Error("expected v2");
      }
      expect(afterChange.rateVersionId).toBe(gbpUsdRateV2.id);
      expect(afterChange.fixedRate).toBe(GBP_USD_RATE_V2);
    });
  });

  describe("BR-023 — adjustments preserve original SUCCESSFUL payment", () => {
    it("derives refund amounts from the payment snapshot without mutating payment fields", () => {
      const payment = crossCurrencyPayment();
      const before = {
        invoiceAmountApplied: payment.invoiceAmountApplied,
        convertedSettlementAmount: payment.convertedSettlementAmount,
        fixedConversionRate: payment.fixedConversionRate,
      };

      const refund = resolveFullRefundAmounts({ payment, actualSettlementAmount: null });
      expect(refund.invoiceAmount).toBe("100");
      expect(refund.settlementAmount).toBe("125");
      expect(payment.invoiceAmountApplied).toBe(before.invoiceAmountApplied);
      expect(payment.convertedSettlementAmount).toBe(before.convertedSettlementAmount);
      expect(payment.fixedConversionRate).toBe(before.fixedConversionRate);
    });

    it("derives chargeback debit amounts from the payment snapshot", () => {
      const payment = crossCurrencyPayment();
      const debit = resolveChargebackDebitLossAmounts({ payment, actualSettlementAmount: null });
      expect(debit.invoiceAmount).toBe("100");
      expect(debit.settlementAmount).toBe("125");
      expect(debit.amount).toBe("125");
    });
  });

  describe("BR-024 — open disputes excluded from CB/RF", () => {
    it("leaves CB/RF unchanged when only open disputes exist", () => {
      const withoutDisputes = computeCbrf({
        adjustments: [],
        currencyCode: "USD",
        decimalPrecision: 2,
      });
      const withOpenDisputes = computeCbrf({
        adjustments: [
          { type: "DISPUTE", status: "OPEN", amount: "500.00" },
          { type: "DISPUTE", status: "UNDER_REVIEW", amount: "200.00" },
        ],
        currencyCode: "USD",
        decimalPrecision: 2,
      });
      expect(withOpenDisputes.amount).toBe(withoutDisputes.amount);
      expect(withOpenDisputes.amount).toBe("0");
    });

    it("reports open disputes separately in reporting totals", () => {
      const totals = computeReportingNetTotals({
        payments: [{ status: "SUCCESSFUL", amount: "500.00" }],
        adjustments: [
          { type: "DISPUTE", status: "OPEN", amount: "200.00" },
          { type: "REFUND", status: "PROCESSED", amount: "75.00" },
        ],
        currencyCode: "USD",
        decimalPrecision: 2,
      });
      expect(totals.cbrf.amount).toBe("75");
      expect(totals.openDisputes.amount).toBe("200");
      expect(totals.netGTotal.amount).toBe("425");
    });
  });

  describe("BR-025 — refund/chargeback conversion from snapshot or merchant actual", () => {
    it("uses payment snapshot for full refund settlement when merchant actual is absent", () => {
      const settlement = resolveRefundSettlementAmount({
        paymentConvertedSettlementAmount: "125.00",
        actualSettlementAmount: null,
      });
      expect(settlement).toBe("125");
    });

    it("uses merchant actual settlement when provided instead of recalculating from today's rate", () => {
      const settlement = resolveRefundSettlementAmount({
        paymentConvertedSettlementAmount: "125.00",
        actualSettlementAmount: "123.50",
      });
      expect(settlement).toBe("123.5");
    });

    it("uses payment fixed-rate snapshot for partial refunds, not the active Admin rate", () => {
      const payment = crossCurrencyPayment();
      const partial = resolvePartialRefundAmounts({
        payment,
        invoiceAmount: "50.00",
        actualSettlementAmount: null,
      });
      expectMoneyEqual(partial.settlementAmount, "62.5");
      expect(partial.settlementAmount).not.toBe("64");
    });
  });

  describe("BR-026 — Net G.Total = Gross Receipts − CB/RF", () => {
    it("computes Net G.Total from gross receipts and CB/RF in settlement currency", () => {
      const gross = computeGrossReceipts({
        payments: [
          { status: "SUCCESSFUL", amount: "1000.00" },
          { status: "PENDING", amount: "999.00" },
        ],
        currencyCode: "USD",
        decimalPrecision: 2,
      });
      const cbrf = computeCbrf({
        adjustments: [
          { type: "REFUND", status: "PROCESSED", amount: "100.00" },
          { type: "CHARGEBACK", status: "DEBITED", amount: "50.25" },
        ],
        currencyCode: "USD",
        decimalPrecision: 2,
      });
      const net = computeNetGTotal({
        grossReceipts: gross.amount,
        cbrf: cbrf.amount,
        currencyCode: "USD",
        decimalPrecision: 2,
      });
      expectMoneyEqual(gross.amount, "1000");
      expectMoneyEqual(cbrf.amount, "150.25");
      expectMoneyEqual(net.amount, "849.75");
    });
  });

  describe("conversion snapshot locking (TASK-046)", () => {
    it("requires version metadata for cross-currency snapshots", () => {
      const payment = crossCurrencyPayment();
      expect(isCrossCurrencyPayment(payment)).toBe(true);
      expect(isConversionSnapshotComplete(payment)).toBe(true);
      expect(
        isConversionSnapshotComplete({
          ...payment,
          rateVersionId: null,
        }),
      ).toBe(false);
    });
  });

  describe("invoice numbering (BR-003)", () => {
    it("formats company-scoped numbers and rejects client-supplied values", () => {
      expect(formatInvoiceNumber({ prefix: "VX-", sequence: 1 })).toBe("VX-000001");
      expect(formatInvoiceNumber({ prefix: "VX-", sequence: 7, year: 2026 })).toBe(
        "VX-2026-000007",
      );
      expect(rejectHandEditedInvoiceNumber({ invoiceNumber: "VX-000001" })?.ok).toBe(false);
      expect(rejectHandEditedInvoiceNumber({ companyId: "x" })).toBeNull();
    });
  });

  describe("invoice payment status logic", () => {
    it("derives Partially Paid then Paid from confirmed applications only", () => {
      const partial = computeInvoicePaymentAllocation({
        currentStatus: "ISSUED",
        invoiceTotal: "100.00",
        invoiceCurrencyCode: "GBP",
        decimalPrecision: 2,
        payments: [{ status: "SUCCESSFUL", invoiceAmountApplied: "40.00" }],
      });
      expect(partial.status).toBe("PARTIALLY_PAID");
      expect(partial.outstandingAmount).toBe("60");

      const paid = computeInvoicePaymentAllocation({
        currentStatus: "PARTIALLY_PAID",
        invoiceTotal: "100.00",
        invoiceCurrencyCode: "GBP",
        decimalPrecision: 2,
        payments: [
          { status: "SUCCESSFUL", invoiceAmountApplied: "40.00" },
          { status: "SUCCESSFUL", invoiceAmountApplied: "60.00" },
        ],
      });
      expect(paid.status).toBe("PAID");
      expect(paid.outstandingAmount).toBe("0");
    });

    it("evaluates overdue only for issued/partial with balance and past due date", () => {
      const asOf = new Date("2026-08-28T12:00:00.000Z");
      const eligible = {
        status: "ISSUED" as const,
        dueDate: new Date("2026-08-01T00:00:00.000Z"),
        outstandingAmount: "25.00",
      };
      expect(invoiceMeetsOverdueRule(eligible, asOf)).toBe(true);
      expect(evaluateOverdueStatus(eligible, asOf)).toBe("OVERDUE");
      expect(
        deriveInvoiceStatusFromPayments({
          currentStatus: "PAID",
          confirmedPaidAmount: "100",
          isSettledWithinTolerance: true,
        }),
      ).toBe("PAID");
    });
  });

  describe("E2E-13 — end-to-end calculation chain", () => {
    it("locks cross-currency conversion, ignores fees, survives rate change, and reports Net G.Total", () => {
      const paymentDate = new Date("2026-03-15T00:00:00.000Z");
      const rateAtPayment = selectEffectiveRate(
        [gbpUsdRateV1, gbpUsdRateV2],
        "GBP",
        "USD",
        paymentDate,
      );
      expect(rateAtPayment.ok).toBe(true);
      if (!rateAtPayment.ok) {
        throw new Error("expected payment-time rate");
      }

      const conversion = computeConvertedSettlementAmount({
        invoiceAmountApplied: "100.00",
        invoiceCurrencyCode: "GBP",
        settlementCurrencyCode: "USD",
        fixedConversionRate: rateAtPayment.fixedRate,
        settlementDecimalPrecision: 2,
        processorFee: "9.99",
      });
      expect(conversion.convertedSettlementAmount.amount).toBe("125");
      expect(conversion.processorFeeExcluded).toBe(true);

      const payment = crossCurrencyPayment({
        fixedConversionRate: rateAtPayment.fixedRate,
        rateVersionId: rateAtPayment.rateVersionId,
        convertedSettlementAmount: conversion.convertedSettlementAmount.amount,
        processorFeeAmount: "9.99",
      });
      expect(isConversionSnapshotComplete(payment)).toBe(true);

      const allocation = computeInvoicePaymentAllocation({
        currentStatus: "ISSUED",
        invoiceTotal: "100.00",
        invoiceCurrencyCode: "GBP",
        decimalPrecision: 2,
        payments: [payment],
      });
      expect(allocation.status).toBe("PAID");
      expect(allocation.outstandingAmount).toBe("0");

      const laterRate = selectEffectiveRate(
        [gbpUsdRateV1, gbpUsdRateV2],
        "GBP",
        "USD",
        new Date("2026-09-01T00:00:00.000Z"),
      );
      expect(laterRate.ok).toBe(true);
      if (!laterRate.ok) {
        throw new Error("expected later rate");
      }
      expect(laterRate.fixedRate).toBe(GBP_USD_RATE_V2);
      expectMoneyEqual(payment.convertedSettlementAmount, "125.00");

      const partialRefund = resolvePartialRefundAmounts({
        payment,
        invoiceAmount: "40.00",
        actualSettlementAmount: null,
      });
      expectMoneyEqual(partialRefund.settlementAmount, "50");

      const adjustments = [
        adjustmentRow({
          type: "REFUND",
          status: "PROCESSED",
          amount: partialRefund.settlementAmount,
          invoiceAmount: "40.00",
          settlementAmount: partialRefund.settlementAmount,
        }),
        adjustmentRow({
          type: "DISPUTE",
          status: "OPEN",
          amount: "999.00",
          invoiceAmount: "999.00",
          settlementAmount: "999.00",
        }),
      ];

      const totals = computeReportingNetTotals({
        payments: [{ status: "SUCCESSFUL", amount: payment.convertedSettlementAmount }],
        adjustments,
        currencyCode: "USD",
        decimalPrecision: 2,
        processorFees: [payment.processorFeeAmount ?? "0"],
      });
      expectMoneyEqual(totals.grossReceipts.amount, "125");
      expectMoneyEqual(totals.cbrf.amount, "50");
      expectMoneyEqual(totals.netGTotal.amount, "75");
      expectMoneyEqual(totals.openDisputes.amount, "999");
    });
  });
});
