/**
 * Linked payment adjustment records (BR-023).
 * Original SUCCESSFUL payment financial fields are never rewritten.
 */

export const PAYMENT_ADJUSTMENT_TYPES = [
  "DISPUTE",
  "REFUND",
  "CHARGEBACK",
  "REVERSAL",
  "NOTE",
] as const;

export type PaymentAdjustmentType = (typeof PAYMENT_ADJUSTMENT_TYPES)[number];

export const PAYMENT_ADJUSTMENT_STATUSES = [
  "OPEN",
  "UNDER_REVIEW",
  "PROCESSED",
  "DEBITED",
  "LOST",
  "WON",
  "REVERSED",
  "CANCELLED",
] as const;

export type PaymentAdjustmentStatus = (typeof PAYMENT_ADJUSTMENT_STATUSES)[number];

/** Dispute statuses with no financial deduction (BR-024). */
export const DISPUTE_OPEN_STATUSES = ["OPEN", "UNDER_REVIEW"] as const;

export type DisputeOpenStatus = (typeof DISPUTE_OPEN_STATUSES)[number];

/** Active adjustment-note status (TASK-068). Informational only — never in CB/RF. */
export const ADJUSTMENT_NOTE_STATUSES = ["OPEN"] as const;

export type AdjustmentNoteStatus = (typeof ADJUSTMENT_NOTE_STATUSES)[number];

export type PaymentAdjustmentRecord = {
  readonly id: string;
  readonly companyId: string;
  readonly paymentId: string;
  readonly type: PaymentAdjustmentType;
  readonly status: PaymentAdjustmentStatus;
  readonly amount: string;
  readonly invoiceAmount: string | null;
  readonly settlementAmount: string | null;
  readonly reason: string | null;
  readonly merchantReference: string | null;
  readonly notes: string | null;
  readonly effectiveDate: Date;
  readonly openedAt: Date | null;
  readonly processedAt: Date | null;
  readonly resolvedAt: Date | null;
  readonly createdByUserId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type PaymentDisputeLifecycle = "DISPUTED" | "UNDER_REVIEW";

export type PaymentRefundLifecycle = "REFUNDED";

export type PaymentChargebackLifecycle =
  "CHARGEBACK_DEBITED" | "CHARGEBACK_LOST" | "CHARGEBACK_WON" | "CHARGEBACK_REVERSED";

/** Chargeback statuses with financial deduction included in CB/RF (BR-024). */
export const CHARGEBACK_DEBIT_LOSS_STATUSES = ["DEBITED", "LOST"] as const;

export type ChargebackDebitLossStatus = (typeof CHARGEBACK_DEBIT_LOSS_STATUSES)[number];

/** Chargeback won/reversal statuses that restore net CB/RF impact (BR-024 / TASK-067). */
export const CHARGEBACK_WON_REVERSAL_STATUSES = ["WON", "REVERSED"] as const;

export type ChargebackWonReversalStatus = (typeof CHARGEBACK_WON_REVERSAL_STATUSES)[number];

export function isDisputeOpenStatus(status: PaymentAdjustmentStatus): status is DisputeOpenStatus {
  return status === "OPEN" || status === "UNDER_REVIEW";
}

export function isProcessedRefund(
  adjustment: Pick<PaymentAdjustmentRecord, "type" | "status">,
): boolean {
  return adjustment.type === "REFUND" && adjustment.status === "PROCESSED";
}

export function isChargebackDebitLoss(
  adjustment: Pick<PaymentAdjustmentRecord, "type" | "status">,
): boolean {
  return (
    adjustment.type === "CHARGEBACK" &&
    (adjustment.status === "DEBITED" || adjustment.status === "LOST")
  );
}

/**
 * Reversing adjustment for chargeback won/reversal (TASK-067).
 * Uses type REVERSAL + WON/REVERSED — never edits the original debit row (BR-023).
 */
export function isChargebackWonReversal(
  adjustment: Pick<PaymentAdjustmentRecord, "type" | "status">,
): boolean {
  return (
    adjustment.type === "REVERSAL" &&
    (adjustment.status === "WON" || adjustment.status === "REVERSED")
  );
}

/** Informational adjustment note (TASK-068). No financial effect. */
export function isAdjustmentNote(
  adjustment: Pick<PaymentAdjustmentRecord, "type" | "status">,
): boolean {
  return adjustment.type === "NOTE" && adjustment.status === "OPEN";
}

/** Cancelled adjustments are retained for audit and excluded from financial totals. */
export function isCancelledAdjustment(
  adjustment: Pick<PaymentAdjustmentRecord, "status">,
): boolean {
  return adjustment.status === "CANCELLED";
}

/**
 * Whether an adjustment contributes to financial totals (CB/RF and similar).
 * Cancelled rows are always excluded (TASK-068). Open disputes and notes never contribute.
 */
export function isIncludedInFinancialTotals(
  adjustment: Pick<PaymentAdjustmentRecord, "type" | "status">,
): boolean {
  if (isCancelledAdjustment(adjustment)) {
    return false;
  }
  return (
    isProcessedRefund(adjustment) ||
    isChargebackDebitLoss(adjustment) ||
    isChargebackWonReversal(adjustment)
  );
}

/**
 * Lifecycle badge derived from linked adjustments. Core payment status stays SUCCESSFUL.
 */
export function paymentDisputeLifecycle(
  adjustments: readonly Pick<PaymentAdjustmentRecord, "type" | "status">[],
): PaymentDisputeLifecycle | null {
  const openDisputes = adjustments.filter(
    (row) => row.type === "DISPUTE" && isDisputeOpenStatus(row.status),
  );
  if (openDisputes.length === 0) {
    return null;
  }
  if (openDisputes.some((row) => row.status === "UNDER_REVIEW")) {
    return "UNDER_REVIEW";
  }
  return "DISPUTED";
}

/**
 * Refund lifecycle badge from linked PROCESSED REFUND adjustments (TASK-064).
 * Does not rewrite the original SUCCESSFUL payment status.
 */
export function paymentRefundLifecycle(
  adjustments: readonly Pick<PaymentAdjustmentRecord, "type" | "status">[],
): PaymentRefundLifecycle | null {
  return adjustments.some(isProcessedRefund) ? "REFUNDED" : null;
}

/**
 * Chargeback lifecycle badge from linked debit/loss and won/reversal adjustments (TASK-066/067).
 * Won/reversal takes precedence. Does not rewrite the original SUCCESSFUL payment status.
 */
export function paymentChargebackLifecycle(
  adjustments: readonly Pick<PaymentAdjustmentRecord, "type" | "status">[],
): PaymentChargebackLifecycle | null {
  const wonReversal = adjustments.filter(isChargebackWonReversal);
  if (wonReversal.length > 0) {
    if (wonReversal.some((row) => row.status === "REVERSED")) {
      return "CHARGEBACK_REVERSED";
    }
    return "CHARGEBACK_WON";
  }

  const debitLoss = adjustments.filter(isChargebackDebitLoss);
  if (debitLoss.length === 0) {
    return null;
  }
  if (debitLoss.some((row) => row.status === "LOST")) {
    return "CHARGEBACK_LOST";
  }
  return "CHARGEBACK_DEBITED";
}

export type AdjustmentFinancialImpactKind = "informational" | "debit" | "credit" | "cancelled";

/**
 * Clear informational vs financial debit/credit labeling for adjustment UI (TASK-069 / BR-024).
 * Does not rewrite original SUCCESSFUL payment status (BR-023).
 */
export function adjustmentFinancialImpact(
  adjustment: Pick<PaymentAdjustmentRecord, "type" | "status">,
): { readonly kind: AdjustmentFinancialImpactKind; readonly label: string } {
  if (isCancelledAdjustment(adjustment)) {
    return { kind: "cancelled", label: "Cancelled — excluded from financial totals" };
  }
  if (adjustment.type === "DISPUTE" && isDisputeOpenStatus(adjustment.status)) {
    return {
      kind: "informational",
      label: "Informational dispute — no financial deduction until debit/refund",
    };
  }
  if (isAdjustmentNote(adjustment)) {
    return { kind: "informational", label: "Informational note — no financial effect" };
  }
  if (isProcessedRefund(adjustment) || isChargebackDebitLoss(adjustment)) {
    return { kind: "debit", label: "Financial debit — included in CB/RF" };
  }
  if (isChargebackWonReversal(adjustment)) {
    return { kind: "credit", label: "Financial credit — restores net CB/RF impact" };
  }
  return { kind: "informational", label: "No financial effect" };
}

/**
 * Lifecycle badges derived from linked adjustments. Core payment status stays SUCCESSFUL (BR-023).
 */
export function paymentAdjustmentLifecycleBadges(
  adjustments: readonly Pick<PaymentAdjustmentRecord, "type" | "status">[],
): {
  readonly dispute: PaymentDisputeLifecycle | null;
  readonly refund: PaymentRefundLifecycle | null;
  readonly chargeback: PaymentChargebackLifecycle | null;
} {
  return {
    dispute: paymentDisputeLifecycle(adjustments),
    refund: paymentRefundLifecycle(adjustments),
    chargeback: paymentChargebackLifecycle(adjustments),
  };
}

/**
 * Which adjustment mutations are offered in UI for a SUCCESSFUL payment (TASK-069).
 * Server authorization and invariants remain authoritative.
 */
export function paymentAdjustmentAvailableActions(
  paymentStatus: "PENDING" | "SUCCESSFUL" | "FAILED",
  adjustments: readonly Pick<PaymentAdjustmentRecord, "type" | "status">[],
): {
  readonly dispute: boolean;
  readonly fullRefund: boolean;
  readonly partialRefund: boolean;
  readonly chargebackDebit: boolean;
  readonly chargebackWon: boolean;
  readonly note: boolean;
} {
  if (paymentStatus !== "SUCCESSFUL") {
    return {
      dispute: false,
      fullRefund: false,
      partialRefund: false,
      chargebackDebit: false,
      chargebackWon: false,
      note: false,
    };
  }

  const hasProcessedRefund = adjustments.some(isProcessedRefund);
  const hasChargebackDebit = adjustments.some(isChargebackDebitLoss);
  const hasChargebackWon = adjustments.some(isChargebackWonReversal);

  return {
    dispute: true,
    fullRefund: !hasProcessedRefund,
    partialRefund: true,
    chargebackDebit: !hasChargebackDebit,
    chargebackWon: hasChargebackDebit && !hasChargebackWon,
    note: true,
  };
}
