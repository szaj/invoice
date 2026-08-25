import { computeInvoiceOutstanding } from "@/domain/money/outstanding";
import { computeCbrf } from "@/domain/money/cbrf";
import { isDisputeOpenStatus, type PaymentAdjustmentRecord } from "@/domain/payments/adjustments";
import { confirmedInvoiceApplicationsFromPayments } from "@/domain/payments/reconciliation";
import type { PaymentRecord } from "@/domain/payments/types";
import { DISPUTE_REQUIRES_SUCCESSFUL_PAYMENT } from "@/domain/disputes/types";

export function assertPaymentCanOpenDispute(status: PaymentRecord["status"]): void {
  if (status !== "SUCCESSFUL") {
    throw new Error(DISPUTE_REQUIRES_SUCCESSFUL_PAYMENT);
  }
}

export function assertOpenDisputeHasNoFinancialEffect(adjustment: PaymentAdjustmentRecord): void {
  if (adjustment.type !== "DISPUTE" || !isDisputeOpenStatus(adjustment.status)) {
    throw new Error(DISPUTE_REQUIRES_SUCCESSFUL_PAYMENT);
  }
}

/**
 * Outstanding uses SUCCESSFUL payment applications only (BR-009).
 * Dispute adjustments are not applications and must not change the result (BR-024).
 */
export function outstandingAfterDisputeOpen(input: {
  readonly invoiceTotal: string;
  readonly invoiceCurrencyCode: string;
  readonly decimalPrecision: number;
  readonly payments: readonly Pick<PaymentRecord, "status" | "invoiceAmountApplied">[];
  readonly adjustments: readonly Pick<PaymentAdjustmentRecord, "type" | "status" | "amount">[];
}): string {
  void input.adjustments;
  return computeInvoiceOutstanding({
    invoiceTotal: input.invoiceTotal,
    invoiceCurrencyCode: input.invoiceCurrencyCode,
    confirmedApplications: confirmedInvoiceApplicationsFromPayments(input.payments),
    decimalPrecision: input.decimalPrecision,
  }).amount;
}

export function cbrfAfterDisputeOpen(
  adjustments: readonly Pick<PaymentAdjustmentRecord, "type" | "status" | "amount">[],
  currencyCode: string,
  decimalPrecision: number,
): string {
  return computeCbrf({
    adjustments,
    currencyCode,
    decimalPrecision,
  }).amount;
}
