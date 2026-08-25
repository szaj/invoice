"use server";

import { revalidatePath } from "next/cache";

import { authorizePermission } from "@/domain/authz/authorize";
import { computeCbrf, sumOpenDisputeAmounts } from "@/domain/money";
import {
  adjustmentFinancialImpact,
  isCancelledAdjustment,
  paymentAdjustmentAvailableActions,
  paymentAdjustmentLifecycleBadges,
  type PaymentAdjustmentRecord,
  type PaymentChargebackLifecycle,
  type PaymentDisputeLifecycle,
  type PaymentRefundLifecycle,
} from "@/domain/payments/adjustments";
import { PAYMENT_ADJUST_FORBIDDEN } from "@/domain/payments/adjustment-history";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import {
  recordChargebackDebitLoss,
  recordChargebackWonReversal,
} from "@/server/chargebacks/chargeback-service";
import { PrismaCurrencyStore } from "@/server/currencies/currency-repository";
import { openPaymentDispute } from "@/server/disputes/dispute-service";
import {
  addPaymentAdjustmentNote,
  cancelPaymentAdjustment,
  listPaymentAdjustments,
} from "@/server/payments/adjustment-history-service";
import { loadPaymentForUi, type PaymentDetailView } from "@/server/payments/actions";
import { processFullRefund, processPartialRefund } from "@/server/refunds/refund-service";

export type PaymentAdjustmentUiRow = {
  readonly id: string;
  readonly type: PaymentAdjustmentRecord["type"];
  readonly status: PaymentAdjustmentRecord["status"];
  readonly amount: string;
  readonly invoiceAmount: string | null;
  readonly settlementAmount: string | null;
  readonly reason: string | null;
  readonly merchantReference: string | null;
  readonly notes: string | null;
  readonly effectiveDate: string;
  readonly createdAt: string;
  readonly financialImpactKind: ReturnType<typeof adjustmentFinancialImpact>["kind"];
  readonly financialImpactLabel: string;
  readonly canCancel: boolean;
};

export type PaymentCbrfImpactView = {
  readonly amount: string;
  readonly currencyCode: string;
  readonly openDisputeAmount: string;
};

export type PaymentAdjustmentUiContext = {
  readonly payment: PaymentDetailView;
  readonly adjustments: readonly PaymentAdjustmentUiRow[];
  readonly canAdjust: boolean;
  /** Payment-level CB/RF from linked adjustments (TASK-070 / BR-024). Fees excluded. */
  readonly cbrfImpact: PaymentCbrfImpactView;
  readonly lifecycle: {
    readonly dispute: PaymentDisputeLifecycle | null;
    readonly refund: PaymentRefundLifecycle | null;
    readonly chargeback: PaymentChargebackLifecycle | null;
  };
  readonly availableActions: ReturnType<typeof paymentAdjustmentAvailableActions>;
};

export type AdjustmentUiActionResult =
  { ok: true; message?: string } | { ok: false; error: string; status?: number };

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toIsoDateTime(value: Date): string {
  return value.toISOString();
}

function mapAdjustmentRow(
  row: PaymentAdjustmentRecord,
  canAdjust: boolean,
): PaymentAdjustmentUiRow {
  const impact = adjustmentFinancialImpact(row);
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    amount: row.amount,
    invoiceAmount: row.invoiceAmount,
    settlementAmount: row.settlementAmount,
    reason: row.reason,
    merchantReference: row.merchantReference,
    notes: row.notes,
    effectiveDate: toIsoDate(row.effectiveDate),
    createdAt: toIsoDateTime(row.createdAt),
    financialImpactKind: impact.kind,
    financialImpactLabel: impact.label,
    canCancel: canAdjust && !isCancelledAdjustment(row),
  };
}

function revalidatePaymentPaths(paymentId: string, invoiceId: string): void {
  revalidatePath(`/payments/${paymentId}`);
  revalidatePath("/payments");
  revalidatePath(`/invoices/${invoiceId}`);
}

/**
 * Payment detail + adjustment history for Refund/Adjustment view (TASK-069).
 * Mutations still require payment.adjust server-side; Staff sees history only.
 */
export async function loadPaymentAdjustmentUi(
  paymentId: string,
): Promise<
  { ok: true; data: PaymentAdjustmentUiContext } | { ok: false; error: string; status: number }
> {
  const detail = await loadPaymentForUi(paymentId);
  if (!detail.ok) {
    return { ok: false, error: detail.error, status: detail.status };
  }

  const actor = await getRequestAuthorizationPrincipal();
  const list = await listPaymentAdjustments(actor, paymentId);
  if (!list.ok) {
    return { ok: false, error: list.error, status: list.status };
  }

  const canAdjust = authorizePermission(actor, "payment.adjust").allowed;
  const adjustments = list.data.adjustments.map((row) => mapAdjustmentRow(row, canAdjust));
  const lifecycle = paymentAdjustmentLifecycleBadges(list.data.adjustments);
  const availableActions = paymentAdjustmentAvailableActions(
    detail.data.status,
    list.data.adjustments,
  );

  const settlementCurrency = await new PrismaCurrencyStore().findByCode(
    detail.data.settlementCurrencyCode,
  );
  const settlementPrecision = settlementCurrency?.decimalPrecision ?? 2;
  const cbrfInputs = list.data.adjustments.map((row) => ({
    type: row.type,
    status: row.status,
    amount: row.amount,
  }));
  const cbrf = computeCbrf({
    adjustments: cbrfInputs,
    currencyCode: detail.data.settlementCurrencyCode,
    decimalPrecision: settlementPrecision,
    processorFees: detail.data.processorFeeAmount != null ? [detail.data.processorFeeAmount] : null,
  });
  const openDisputes = sumOpenDisputeAmounts({
    adjustments: cbrfInputs,
    currencyCode: detail.data.settlementCurrencyCode,
    decimalPrecision: settlementPrecision,
  });

  return {
    ok: true,
    data: {
      payment: detail.data,
      adjustments,
      canAdjust,
      cbrfImpact: {
        amount: cbrf.amount,
        currencyCode: cbrf.currencyCode,
        openDisputeAmount: openDisputes.amount,
      },
      lifecycle,
      availableActions: canAdjust
        ? availableActions
        : {
            dispute: false,
            fullRefund: false,
            partialRefund: false,
            chargebackDebit: false,
            chargebackWon: false,
            note: false,
          },
    },
  };
}

export async function openPaymentDisputeAction(
  paymentId: string,
  input: unknown,
): Promise<AdjustmentUiActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await openPaymentDispute(actor, paymentId, input);
  if (!result.ok) {
    return {
      ok: false,
      error: result.status === 403 ? PAYMENT_ADJUST_FORBIDDEN : result.error,
      status: result.status,
    };
  }
  revalidatePaymentPaths(result.data.payment.id, result.data.payment.invoiceId);
  return {
    ok: true,
    message: "Dispute opened. No financial deduction until a debit or refund is recorded.",
  };
}

export async function processFullRefundAction(
  paymentId: string,
  input: unknown,
): Promise<AdjustmentUiActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await processFullRefund(actor, paymentId, input);
  if (!result.ok) {
    return {
      ok: false,
      error: result.status === 403 ? PAYMENT_ADJUST_FORBIDDEN : result.error,
      status: result.status,
    };
  }
  revalidatePaymentPaths(result.data.payment.id, result.data.payment.invoiceId);
  return { ok: true, message: "Full refund recorded. Original payment remains Successful." };
}

export async function processPartialRefundAction(
  paymentId: string,
  input: unknown,
): Promise<AdjustmentUiActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await processPartialRefund(actor, paymentId, input);
  if (!result.ok) {
    return {
      ok: false,
      error: result.status === 403 ? PAYMENT_ADJUST_FORBIDDEN : result.error,
      status: result.status,
    };
  }
  revalidatePaymentPaths(result.data.payment.id, result.data.payment.invoiceId);
  return { ok: true, message: "Partial refund recorded. Original payment remains Successful." };
}

export async function recordChargebackDebitAction(
  paymentId: string,
  input: unknown,
): Promise<AdjustmentUiActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await recordChargebackDebitLoss(actor, paymentId, input);
  if (!result.ok) {
    return {
      ok: false,
      error: result.status === 403 ? PAYMENT_ADJUST_FORBIDDEN : result.error,
      status: result.status,
    };
  }
  revalidatePaymentPaths(result.data.payment.id, result.data.payment.invoiceId);
  return {
    ok: true,
    message: "Chargeback debit/loss recorded. Original payment remains Successful.",
  };
}

export async function recordChargebackWonAction(
  paymentId: string,
  input: unknown,
): Promise<AdjustmentUiActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await recordChargebackWonReversal(actor, paymentId, input);
  if (!result.ok) {
    return {
      ok: false,
      error: result.status === 403 ? PAYMENT_ADJUST_FORBIDDEN : result.error,
      status: result.status,
    };
  }
  revalidatePaymentPaths(result.data.payment.id, result.data.payment.invoiceId);
  return { ok: true, message: "Chargeback won/reversal recorded. Prior debit row was not edited." };
}

export async function addPaymentAdjustmentNoteAction(
  paymentId: string,
  input: unknown,
): Promise<AdjustmentUiActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await addPaymentAdjustmentNote(actor, paymentId, input);
  if (!result.ok) {
    return {
      ok: false,
      error: result.status === 403 ? PAYMENT_ADJUST_FORBIDDEN : result.error,
      status: result.status,
    };
  }
  revalidatePaymentPaths(result.data.payment.id, result.data.payment.invoiceId);
  return { ok: true, message: "Adjustment note added." };
}

export async function cancelPaymentAdjustmentAction(
  paymentId: string,
  adjustmentId: string,
  input: unknown = {},
): Promise<AdjustmentUiActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "payment.adjust").allowed) {
    return { ok: false, error: PAYMENT_ADJUST_FORBIDDEN, status: 403 };
  }
  const result = await cancelPaymentAdjustment(actor, paymentId, adjustmentId, input);
  if (!result.ok) {
    return {
      ok: false,
      error: result.status === 403 ? PAYMENT_ADJUST_FORBIDDEN : result.error,
      status: result.status,
    };
  }
  revalidatePaymentPaths(result.data.payment.id, result.data.payment.invoiceId);
  return { ok: true, message: "Adjustment cancelled. History retained for audit." };
}
