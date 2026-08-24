import { describe, expect, it } from "vitest";
import { Decimal } from "@prisma/client/runtime/client";

import { SAME_CURRENCY_FIXED_RATE } from "@/domain/fixed-rates/types";
import {
  assertSameCurrencyCodes,
  computeConvertedSettlementAmount,
  computeInvoiceOutstanding,
  formatMoneyForDisplay,
  isWithinRoundingTolerance,
  moneyDecimal,
  MONEY_MIXED_CURRENCY,
  roundMoney,
  sumMoney,
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
