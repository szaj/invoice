import { describe, expect, it } from "vitest";

import { computeConvertedSettlementAmount, computeInvoiceOutstanding } from "@/domain/money";
import {
  assertFeeDoesNotAffectConvertedSettlement,
  assertFeeDoesNotAffectInvoiceOutstanding,
  confirmedInvoiceApplicationsFromPayments,
  normalizePaymentReconciliationFields,
} from "@/domain/payments/reconciliation";
import { PAYMENT_INVALID_INPUT, type PaymentRecord } from "@/domain/payments/types";

describe("payment reconciliation fields (TASK-047 / BR-020)", () => {
  it("stores optional fee and actual received independently without deriving actual received", () => {
    const omittedActual = normalizePaymentReconciliationFields({
      processorFeeAmount: "9.99",
      actualReceivedAmount: null,
      convertedSettlementAmount: "125.00",
    });
    expect(omittedActual.processorFeeAmount).toBe("9.99");
    expect(omittedActual.actualReceivedAmount).toBeNull();
    expect(omittedActual.actualReceivedAmount).not.toBe("115.01");

    const independentActual = normalizePaymentReconciliationFields({
      processorFeeAmount: "9.99",
      actualReceivedAmount: "120.00",
      convertedSettlementAmount: "125.00",
    });
    expect(independentActual.actualReceivedAmount).toBe("120");
    expect(independentActual.actualReceivedAmount).not.toBe("115.01");
  });

  it("rejects negative reconciliation amounts", () => {
    expect(() => normalizePaymentReconciliationFields({ processorFeeAmount: "-0.01" })).toThrow(
      PAYMENT_INVALID_INPUT,
    );
    expect(() => normalizePaymentReconciliationFields({ actualReceivedAmount: "-1" })).toThrow(
      PAYMENT_INVALID_INPUT,
    );
  });

  it("does not change converted settlement or outstanding when the fee changes", () => {
    const invoiceAmountApplied = "100.00";
    const withoutFee = computeConvertedSettlementAmount({
      invoiceAmountApplied,
      invoiceCurrencyCode: "GBP",
      settlementCurrencyCode: "USD",
      fixedConversionRate: "1.25",
      settlementDecimalPrecision: 2,
    });
    const withFee = computeConvertedSettlementAmount({
      invoiceAmountApplied,
      invoiceCurrencyCode: "GBP",
      settlementCurrencyCode: "USD",
      fixedConversionRate: "1.25",
      settlementDecimalPrecision: 2,
      processorFee: "9.99",
    });
    expect(withFee.convertedSettlementAmount.amount).toBe("125");
    expect(withFee.convertedSettlementAmount.amount).toBe(
      withoutFee.convertedSettlementAmount.amount,
    );
    expect(withFee.convertedSettlementAmount.amount).not.toBe("115.01");

    const outstandingWithoutFee = computeInvoiceOutstanding({
      invoiceTotal: "250.00",
      invoiceCurrencyCode: "GBP",
      confirmedApplications: [invoiceAmountApplied],
      decimalPrecision: 2,
    });
    const outstandingWithFee = computeInvoiceOutstanding({
      invoiceTotal: "250.00",
      invoiceCurrencyCode: "GBP",
      confirmedApplications: [invoiceAmountApplied],
      decimalPrecision: 2,
      processorFee: "9.99",
      actualReceivedAmount: "115.01",
    });
    expect(outstandingWithFee.amount).toBe("150");
    expect(outstandingWithFee.amount).toBe(outstandingWithoutFee.amount);
    expect(outstandingWithFee.amount).not.toBe("159.99");

    expect(() =>
      assertFeeDoesNotAffectConvertedSettlement({
        invoiceAmountApplied,
        invoiceCurrencyCode: "GBP",
        settlementCurrencyCode: "USD",
        fixedConversionRate: "1.25",
        settlementDecimalPrecision: 2,
        convertedSettlementAmount: withFee.convertedSettlementAmount.amount,
        processorFeeAmount: "9.99",
      }),
    ).not.toThrow();

    expect(() =>
      assertFeeDoesNotAffectInvoiceOutstanding({
        invoiceTotal: "250.00",
        invoiceCurrencyCode: "GBP",
        confirmedApplications: [invoiceAmountApplied],
        decimalPrecision: 2,
        processorFeeAmount: "9.99",
        actualReceivedAmount: "115.01",
      }),
    ).not.toThrow();
  });

  it("uses only successful invoice-currency applications for outstanding, never fee or settlement", () => {
    const payments = [
      {
        status: "SUCCESSFUL",
        invoiceAmountApplied: "40.00",
        processorFeeAmount: "5.00",
        convertedSettlementAmount: "50.00",
        actualReceivedAmount: "45.00",
      },
      {
        status: "PENDING",
        invoiceAmountApplied: "10.00",
        processorFeeAmount: "1.00",
        convertedSettlementAmount: "12.50",
        actualReceivedAmount: null,
      },
      {
        status: "FAILED",
        invoiceAmountApplied: "10.00",
        processorFeeAmount: null,
        convertedSettlementAmount: "12.50",
        actualReceivedAmount: null,
      },
    ] as const satisfies ReadonlyArray<
      Pick<
        PaymentRecord,
        | "status"
        | "invoiceAmountApplied"
        | "processorFeeAmount"
        | "convertedSettlementAmount"
        | "actualReceivedAmount"
      >
    >;

    expect(confirmedInvoiceApplicationsFromPayments(payments)).toEqual(["40.00"]);
    const outstanding = computeInvoiceOutstanding({
      invoiceTotal: "100.00",
      invoiceCurrencyCode: "USD",
      confirmedApplications: confirmedInvoiceApplicationsFromPayments(payments),
      decimalPrecision: 2,
      processorFee: "5.00",
      actualReceivedAmount: "45.00",
    });
    expect(outstanding.amount).toBe("60");
  });
});
