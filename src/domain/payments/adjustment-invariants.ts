import {
  ADJUSTMENT_ALREADY_CANCELLED,
  ADJUSTMENT_DELETE_FORBIDDEN,
  ADJUSTMENT_NOTE_REQUIRES_SUCCESSFUL_PAYMENT,
  ADJUSTMENT_NOT_FOUND,
} from "@/domain/payments/adjustment-history";
import {
  isCancelledAdjustment,
  isIncludedInFinancialTotals,
  type PaymentAdjustmentRecord,
} from "@/domain/payments/adjustments";
import type { PaymentStatus } from "@/domain/payments/types";

export function assertPaymentCanAddAdjustmentNote(status: PaymentStatus): void {
  if (status !== "SUCCESSFUL") {
    throw new Error(ADJUSTMENT_NOTE_REQUIRES_SUCCESSFUL_PAYMENT);
  }
}

export function assertAdjustmentCanBeCancelled(
  adjustment: Pick<PaymentAdjustmentRecord, "status"> | null | undefined,
): asserts adjustment is Pick<PaymentAdjustmentRecord, "status"> {
  if (!adjustment) {
    throw new Error(ADJUSTMENT_NOT_FOUND);
  }
  if (isCancelledAdjustment(adjustment)) {
    throw new Error(ADJUSTMENT_ALREADY_CANCELLED);
  }
}

/** Hard-delete of adjustment history is forbidden (TASK-068). */
export function assertAdjustmentHistoryNotDeleted(): never {
  throw new Error(ADJUSTMENT_DELETE_FORBIDDEN);
}

/**
 * Cancelled adjustments must not contribute to CB/RF or other financial totals.
 * Notes and open disputes are also excluded.
 */
export function assertCancelledExcludedFromFinancialTotals(
  adjustments: readonly Pick<PaymentAdjustmentRecord, "type" | "status">[],
): void {
  for (const row of adjustments) {
    if (isCancelledAdjustment(row) && isIncludedInFinancialTotals(row)) {
      throw new Error("Cancelled adjustments must be excluded from financial totals.");
    }
  }
}
