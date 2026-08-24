import { describe, expect, it } from "vitest";

import { assertManualPaymentWithinOpenBalance } from "@/domain/payments/manual";
import { PAYMENT_EXCEEDS_OPEN_BALANCE } from "@/domain/payments/types";

describe("manual payment open-balance guard (TASK-050 / BR-010)", () => {
  it("allows applied amount up to remaining outstanding", () => {
    expect(() =>
      assertManualPaymentWithinOpenBalance({
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
        actualReceivedAmount: "10.00",
      }),
    ).not.toThrow();
  });

  it("rejects applied amount above open balance; fee does not expand balance", () => {
    expect(() =>
      assertManualPaymentWithinOpenBalance({
        invoiceTotal: "100.00",
        invoiceCurrencyCode: "USD",
        invoiceDecimalPrecision: 2,
        invoiceAmountApplied: "40.01",
        existingPayments: [{ status: "SUCCESSFUL", invoiceAmountApplied: "60.00" }],
        processorFeeAmount: "1000.00",
      }),
    ).toThrow(PAYMENT_EXCEEDS_OPEN_BALANCE);
  });
});
