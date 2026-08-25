import { describe, expect, it } from "vitest";

import {
  computeInvoicePaymentAllocation,
  deriveInvoiceStatusFromPayments,
} from "@/domain/invoices/allocation";
import { assertPaymentWithinOpenBalance } from "@/domain/payments/manual";
import { PAYMENT_EXCEEDS_OPEN_BALANCE } from "@/domain/payments/types";

describe("invoice payment allocation (TASK-060 / BR-009)", () => {
  it("derives Partially Paid then Paid as applications complete", () => {
    const partial = computeInvoicePaymentAllocation({
      currentStatus: "ISSUED",
      invoiceTotal: "100.00",
      invoiceCurrencyCode: "GBP",
      decimalPrecision: 2,
      payments: [{ status: "SUCCESSFUL", invoiceAmountApplied: "40.00" }],
      roundingTolerance: "0.01",
    });
    expect(partial.status).toBe("PARTIALLY_PAID");
    expect(partial.confirmedPaidAmount).toBe("40");
    expect(partial.outstandingAmount).toBe("60");
    expect(partial.isSettledWithinTolerance).toBe(false);

    const completing = computeInvoicePaymentAllocation({
      currentStatus: "PARTIALLY_PAID",
      invoiceTotal: "100.00",
      invoiceCurrencyCode: "GBP",
      decimalPrecision: 2,
      payments: [
        { status: "SUCCESSFUL", invoiceAmountApplied: "40.00" },
        { status: "SUCCESSFUL", invoiceAmountApplied: "60.00" },
        { status: "PENDING", invoiceAmountApplied: "999.00" },
        { status: "FAILED", invoiceAmountApplied: "999.00" },
      ],
      roundingTolerance: "0.01",
    });
    expect(completing.status).toBe("PAID");
    expect(completing.confirmedPaidAmount).toBe("100");
    expect(completing.outstandingAmount).toBe("0");
    expect(completing.isSettledWithinTolerance).toBe(true);
  });

  it("treats outstanding within rounding tolerance as Paid", () => {
    const allocation = computeInvoicePaymentAllocation({
      currentStatus: "ISSUED",
      invoiceTotal: "100.00",
      invoiceCurrencyCode: "USD",
      decimalPrecision: 2,
      payments: [{ status: "SUCCESSFUL", invoiceAmountApplied: "99.995" }],
      roundingTolerance: "0.01",
    });
    expect(allocation.isSettledWithinTolerance).toBe(true);
    expect(allocation.status).toBe("PAID");
  });

  it("ignores processor fees and settlement amounts (BR-020)", () => {
    const allocation = computeInvoicePaymentAllocation({
      currentStatus: "ISSUED",
      invoiceTotal: "100.00",
      invoiceCurrencyCode: "GBP",
      decimalPrecision: 2,
      payments: [{ status: "SUCCESSFUL", invoiceAmountApplied: "40.00" }],
      roundingTolerance: "0",
    });
    expect(allocation.confirmedPaidAmount).toBe("40");
    expect(allocation.outstandingAmount).toBe("60");
  });

  it("does not rewrite DRAFT or CANCELLED", () => {
    expect(
      deriveInvoiceStatusFromPayments({
        currentStatus: "CANCELLED",
        confirmedPaidAmount: "50",
        isSettledWithinTolerance: false,
      }),
    ).toBe("CANCELLED");
    expect(
      deriveInvoiceStatusFromPayments({
        currentStatus: "DRAFT",
        confirmedPaidAmount: "0",
        isSettledWithinTolerance: true,
      }),
    ).toBe("DRAFT");
  });

  it("rejects over-application (BR-010; US-015 allow not invented)", () => {
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
});
