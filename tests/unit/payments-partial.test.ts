import { describe, expect, it } from "vitest";

import {
  assertManualPaymentWithinOpenBalance,
  assertPaymentWithinOpenBalance,
} from "@/domain/payments/manual";
import { PAYMENT_EXCEEDS_OPEN_BALANCE } from "@/domain/payments/types";

describe("payment open-balance guard (TASK-059 / BR-010)", () => {
  it("allows a second partial up to remaining outstanding from SUCCESSFUL only", () => {
    expect(() =>
      assertPaymentWithinOpenBalance({
        invoiceTotal: "100.00",
        invoiceCurrencyCode: "USD",
        invoiceDecimalPrecision: 2,
        invoiceAmountApplied: "40.00",
        existingPayments: [
          { status: "SUCCESSFUL", invoiceAmountApplied: "60.00" },
          { status: "PENDING", invoiceAmountApplied: "999.00" },
          { status: "FAILED", invoiceAmountApplied: "999.00" },
        ],
        processorFeeAmount: "50.00",
      }),
    ).not.toThrow();
  });

  it("rejects over-application; fee does not expand balance (US-015 allow not invented)", () => {
    expect(() =>
      assertPaymentWithinOpenBalance({
        invoiceTotal: "100.00",
        invoiceCurrencyCode: "USD",
        invoiceDecimalPrecision: 2,
        invoiceAmountApplied: "40.01",
        existingPayments: [{ status: "SUCCESSFUL", invoiceAmountApplied: "60.00" }],
        processorFeeAmount: "1000.00",
      }),
    ).toThrow(PAYMENT_EXCEEDS_OPEN_BALANCE);
  });

  it("keeps manual alias equivalent", () => {
    expect(assertManualPaymentWithinOpenBalance).toBe(assertPaymentWithinOpenBalance);
  });
});
