import { describe, expect, it } from "vitest";
import { Decimal } from "@prisma/client/runtime/client";

import { SAME_CURRENCY_FIXED_RATE } from "@/domain/fixed-rates/types";
import {
  assertSameCurrencyCodes,
  computeConvertedSettlementAmount,
  computeCbrf,
  computeCbrfBreakdown,
  computeGrossReceipts,
  computeInvoiceOutstanding,
  computeNetGTotal,
  computeReportingNetTotals,
  formatMoneyForDisplay,
  isOpenDisputeExcludedFromCbrf,
  isWithinRoundingTolerance,
  moneyDecimal,
  MONEY_MIXED_CURRENCY,
  roundMoney,
  sumMoney,
  sumOpenDisputeAmounts,
} from "@/domain/money";

describe("moneyDecimal", () => {
  it("accepts Decimal and decimal strings and rejects JS numbers", () => {
    expect(moneyDecimal("10.50").equals(new Decimal("10.50"))).toBe(true);
    expect(moneyDecimal(new Decimal("3.67")).toString()).toBe("3.67");
    expect(() => moneyDecimal(0.1 as unknown as string)).toThrow(/JavaScript number/);
  });
});

describe("computeConvertedSettlementAmount", () => {
  it("applies converted_settlement_amount = invoice_amount_applied × fixed_conversion_rate", () => {
    const result = computeConvertedSettlementAmount({
      invoiceAmountApplied: "100.00",
      invoiceCurrencyCode: "GBP",
      settlementCurrencyCode: "USD",
      fixedConversionRate: "1.250000000000",
      settlementDecimalPrecision: 2,
    });
    expect(result.convertedSettlementAmount.amount).toBe("125");
    expect(result.convertedSettlementAmount.currencyCode).toBe("USD");
    expect(result.fixedConversionRateApplied).toBe("1.25");
    expect(result.rateSource).toBe("admin_fixed_rate");
    expect(result.processorFeeExcluded).toBe(true);
  });

  it("uses same-currency rate 1.000000000000", () => {
    const result = computeConvertedSettlementAmount({
      invoiceAmountApplied: "99.99",
      invoiceCurrencyCode: "USD",
      settlementCurrencyCode: "usd",
      fixedConversionRate: "999", // ignored when same currency
      settlementDecimalPrecision: 2,
    });
    expect(result.rateSource).toBe("same_currency");
    expect(result.fixedConversionRateApplied).toBe(
      new Decimal(SAME_CURRENCY_FIXED_RATE).toString(),
    );
    expect(result.convertedSettlementAmount.amount).toBe("99.99");
  });

  it("excludes merchant/processor fee from conversion (BR-020)", () => {
    const withoutFee = computeConvertedSettlementAmount({
      invoiceAmountApplied: "50.00",
      invoiceCurrencyCode: "AED",
      settlementCurrencyCode: "USD",
      fixedConversionRate: "0.272294000000",
      settlementDecimalPrecision: 2,
    });
    const withFee = computeConvertedSettlementAmount({
      invoiceAmountApplied: "50.00",
      invoiceCurrencyCode: "AED",
      settlementCurrencyCode: "USD",
      fixedConversionRate: "0.272294000000",
      settlementDecimalPrecision: 2,
      processorFee: "9.99",
    });
    expect(withFee.convertedSettlementAmount.amount).toBe(
      withoutFee.convertedSettlementAmount.amount,
    );
    expect(withFee.convertedSettlementAmount.amount).not.toBe("23.60"); // fee must not be added
    expect(withFee.processorFeeExcluded).toBe(true);
  });

  it("rounds settlement amount to currency precision with half-up", () => {
    // 10.00 × 3.675 = 36.75 exact; 10 × 3.6745 = 36.745 → 36.75 half-up at 2 dp
    const result = computeConvertedSettlementAmount({
      invoiceAmountApplied: "10.00",
      invoiceCurrencyCode: "USD",
      settlementCurrencyCode: "AED",
      fixedConversionRate: "3.674500000000",
      settlementDecimalPrecision: 2,
    });
    expect(result.convertedSettlementAmount.amount).toBe("36.75");
    expect(roundMoney("36.744", 2).toString()).toBe("36.74");
    expect(roundMoney("36.745", 2).toString()).toBe("36.75");
  });
});

describe("rounding tolerance from system settings", () => {
  it("treats residual within tolerance as settled", () => {
    expect(isWithinRoundingTolerance("0.004", "0", "0.01")).toBe(true);
    expect(isWithinRoundingTolerance("0.02", "0", "0.01")).toBe(false);

    const outstanding = computeInvoiceOutstanding({
      invoiceTotal: "100.00",
      invoiceCurrencyCode: "USD",
      confirmedApplications: ["99.995"],
      decimalPrecision: 2,
      roundingTolerance: "0.01",
    });
    // 100 - 99.995 = 0.005 → rounds to 0.01 at 2 dp; still within 0.01 of zero?
    // Actually roundMoney(0.005, 2) = 0.01; |0.01-0| <= 0.01 → true
    expect(outstanding.amount).toBe("0.01");
    expect(outstanding.isSettledWithinTolerance).toBe(true);
  });
});

describe("computeInvoiceOutstanding", () => {
  it("computes outstanding from confirmed applications only (BR-009)", () => {
    const result = computeInvoiceOutstanding({
      invoiceTotal: "250.00",
      invoiceCurrencyCode: "GBP",
      confirmedApplications: ["100.00", "50.25"],
      decimalPrecision: 2,
    });
    expect(result.amount).toBe("99.75");
    expect(result.currencyCode).toBe("GBP");
    expect(result.isSettledWithinTolerance).toBe(false);
  });

  it("excludes merchant/processor fee and actual received from outstanding (BR-020)", () => {
    const withoutFee = computeInvoiceOutstanding({
      invoiceTotal: "100.00",
      invoiceCurrencyCode: "USD",
      confirmedApplications: ["40.00"],
      decimalPrecision: 2,
    });
    const withFee = computeInvoiceOutstanding({
      invoiceTotal: "100.00",
      invoiceCurrencyCode: "USD",
      confirmedApplications: ["40.00"],
      decimalPrecision: 2,
      processorFee: "3.00",
      actualReceivedAmount: "37.00",
    });
    expect(withFee.amount).toBe(withoutFee.amount);
    expect(withFee.amount).toBe("60");
  });
});

describe("mixed currency guard", () => {
  it("rejects unlabeled mixed-currency aggregation (BR-013)", () => {
    expect(() => assertSameCurrencyCodes(["USD", "AED"])).toThrow(MONEY_MIXED_CURRENCY);
    expect(assertSameCurrencyCodes(["usd", "USD"])).toBe("USD");
  });
});

describe("display formatting", () => {
  it("formats for display without becoming the source of truth", () => {
    expect(formatMoneyForDisplay("12.5", "usd", 2)).toBe("12.50 USD");
  });
});

describe("sumMoney", () => {
  it("sums with Decimal and never JS float", () => {
    const total = sumMoney(["0.1", "0.2"]);
    expect(total.equals(new Decimal("0.3"))).toBe(true);
    expect(total.toString()).toBe("0.3");
  });
});

describe("computeCbrf dispute exclusion (TASK-063 / BR-024)", () => {
  it("excludes open and under-review disputes from CB/RF", () => {
    expect(isOpenDisputeExcludedFromCbrf({ type: "DISPUTE", status: "OPEN" })).toBe(true);
    expect(isOpenDisputeExcludedFromCbrf({ type: "DISPUTE", status: "UNDER_REVIEW" })).toBe(true);

    const before = computeCbrf({
      adjustments: [],
      currencyCode: "USD",
      decimalPrecision: 2,
    });
    const after = computeCbrf({
      adjustments: [
        { type: "DISPUTE", status: "OPEN", amount: "100.00" },
        { type: "DISPUTE", status: "UNDER_REVIEW", amount: "40.00" },
      ],
      currencyCode: "USD",
      decimalPrecision: 2,
    });
    expect(before.amount).toBe("0");
    expect(after.amount).toBe(before.amount);
    expect(after.amount).not.toBe("100");
    expect(after.currencyCode).toBe("USD");
  });
});

describe("computeCbrf processed refund (TASK-064 / E2E-15)", () => {
  it("includes PROCESSED REFUND amounts in CB/RF", () => {
    const result = computeCbrf({
      adjustments: [
        { type: "DISPUTE", status: "OPEN", amount: "100.00" },
        { type: "REFUND", status: "PROCESSED", amount: "367.00" },
      ],
      currencyCode: "AED",
      decimalPrecision: 2,
    });
    expect(result.amount).toBe("367");
    expect(result.currencyCode).toBe("AED");
  });
});

describe("computeCbrf processed partial refunds (TASK-065)", () => {
  it("includes only processed partial refund amounts in CB/RF", () => {
    const result = computeCbrf({
      adjustments: [
        { type: "REFUND", status: "PROCESSED", amount: "100.00" },
        { type: "REFUND", status: "PROCESSED", amount: "50.50" },
        { type: "DISPUTE", status: "OPEN", amount: "999.00" },
      ],
      currencyCode: "AED",
      decimalPrecision: 2,
    });
    expect(result.amount).toBe("150.5");
  });
});

describe("computeCbrf chargeback debit/loss (TASK-066 / E2E-16 / BR-024)", () => {
  it("includes CHARGEBACK DEBITED and LOST amounts on the debit/loss effective date", () => {
    const debited = computeCbrf({
      adjustments: [
        { type: "DISPUTE", status: "OPEN", amount: "100.00" },
        { type: "CHARGEBACK", status: "DEBITED", amount: "367.00" },
      ],
      currencyCode: "AED",
      decimalPrecision: 2,
    });
    expect(debited.amount).toBe("367");

    const lost = computeCbrf({
      adjustments: [
        { type: "REFUND", status: "PROCESSED", amount: "50.00" },
        { type: "CHARGEBACK", status: "LOST", amount: "100.00" },
      ],
      currencyCode: "USD",
      decimalPrecision: 2,
    });
    expect(lost.amount).toBe("150");
  });
});

describe("computeCbrf chargeback won/reversal (TASK-067 / E2E-16 / BR-024)", () => {
  it("subtracts REVERSAL WON/REVERSED to restore net impact without mutating debit", () => {
    const restored = computeCbrf({
      adjustments: [
        { type: "CHARGEBACK", status: "DEBITED", amount: "367.00" },
        { type: "REVERSAL", status: "WON", amount: "367.00" },
      ],
      currencyCode: "AED",
      decimalPrecision: 2,
    });
    expect(restored.amount).toBe("0");

    const partial = computeCbrf({
      adjustments: [
        { type: "REFUND", status: "PROCESSED", amount: "50.00" },
        { type: "CHARGEBACK", status: "LOST", amount: "100.00" },
        { type: "REVERSAL", status: "REVERSED", amount: "100.00" },
      ],
      currencyCode: "USD",
      decimalPrecision: 2,
    });
    expect(partial.amount).toBe("50");
  });
});

describe("computeCbrf cancelled adjustments (TASK-068)", () => {
  it("excludes CANCELLED adjustments and NOTE rows from CB/RF totals", () => {
    const result = computeCbrf({
      adjustments: [
        { type: "REFUND", status: "PROCESSED", amount: "80.00" },
        { type: "REFUND", status: "CANCELLED", amount: "80.00" },
        { type: "NOTE", status: "OPEN", amount: "0" },
        { type: "CHARGEBACK", status: "CANCELLED", amount: "25.00" },
      ],
      currencyCode: "USD",
      decimalPrecision: 2,
    });
    expect(result.amount).toBe("80");
  });
});

describe("CB/RF calculation engine (TASK-070 / BR-024 / BR-026)", () => {
  it("computes CB/RF as refunds + chargeback debits − won/reversals and excludes open disputes", () => {
    const result = computeCbrf({
      adjustments: [
        { type: "DISPUTE", status: "OPEN", amount: "500.00" },
        { type: "DISPUTE", status: "UNDER_REVIEW", amount: "200.00" },
        { type: "REFUND", status: "PROCESSED", amount: "100.00" },
        { type: "CHARGEBACK", status: "DEBITED", amount: "50.00" },
        { type: "CHARGEBACK", status: "LOST", amount: "25.00" },
        { type: "REVERSAL", status: "WON", amount: "25.00" },
        { type: "NOTE", status: "OPEN", amount: "0" },
        { type: "REFUND", status: "CANCELLED", amount: "99.00" },
      ],
      currencyCode: "AED",
      decimalPrecision: 2,
    });
    // 100 + 50 + 25 − 25 = 150; disputes/notes/cancelled excluded
    expect(result.amount).toBe("150");
    expect(result.currencyCode).toBe("AED");
  });

  it("never includes merchant/processor fees in CB/RF", () => {
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

  it("breaks CB/RF into refunds, debits, and reversals matching the formula", () => {
    const breakdown = computeCbrfBreakdown({
      adjustments: [
        { type: "REFUND", status: "PROCESSED", amount: "80.00" },
        { type: "CHARGEBACK", status: "LOST", amount: "30.00" },
        { type: "REVERSAL", status: "REVERSED", amount: "10.00" },
        { type: "DISPUTE", status: "OPEN", amount: "999.00" },
      ],
      currencyCode: "USD",
      decimalPrecision: 2,
      processorFees: ["5.00"],
    });
    expect(breakdown.processedRefunds).toBe("80");
    expect(breakdown.chargebackDebitsLosses).toBe("30");
    expect(breakdown.chargebackWonReversals).toBe("10");
    expect(breakdown.cbrf.amount).toBe("100");
  });

  it("computes Gross Receipts from SUCCESSFUL payments only and ignores fees", () => {
    const gross = computeGrossReceipts({
      payments: [
        { status: "SUCCESSFUL", amount: "100.00" },
        { status: "SUCCESSFUL", amount: "50.50" },
        { status: "PENDING", amount: "999.00" },
        { status: "FAILED", amount: "40.00" },
      ],
      currencyCode: "USD",
      decimalPrecision: 2,
      processorFees: ["7.25"],
    });
    expect(gross.amount).toBe("150.5");
    expect(gross.currencyCode).toBe("USD");
  });

  it("computes Net G.Total = Gross Receipts − CB/RF", () => {
    const net = computeNetGTotal({
      grossReceipts: "1000.00",
      cbrf: "150.25",
      currencyCode: "AED",
      decimalPrecision: 2,
    });
    expect(net.amount).toBe("849.75");
    expect(net.currencyCode).toBe("AED");
  });

  it("sums open disputes separately without changing CB/RF or Net G.Total", () => {
    const adjustments = [
      { type: "DISPUTE" as const, status: "OPEN" as const, amount: "200.00" },
      { type: "REFUND" as const, status: "PROCESSED" as const, amount: "75.00" },
    ];
    const open = sumOpenDisputeAmounts({
      adjustments,
      currencyCode: "USD",
      decimalPrecision: 2,
    });
    expect(open.amount).toBe("200");

    const totals = computeReportingNetTotals({
      payments: [
        { status: "SUCCESSFUL", amount: "500.00" },
        { status: "PENDING", amount: "100.00" },
      ],
      adjustments,
      currencyCode: "USD",
      decimalPrecision: 2,
      processorFees: ["9.99"],
    });
    expect(totals.grossReceipts.amount).toBe("500");
    expect(totals.cbrf.amount).toBe("75");
    expect(totals.netGTotal.amount).toBe("425");
    expect(totals.openDisputes.amount).toBe("200");
  });
});
