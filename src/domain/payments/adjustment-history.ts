/**
 * Adjustment history / notes / cancel messages (TASK-068).
 * Cancelled rows are retained for audit and excluded from financial totals.
 */

export const ADJUSTMENT_NOTE_REQUIRES_SUCCESSFUL_PAYMENT =
  "Only a successful payment can receive an adjustment note.";
export const ADJUSTMENT_NOTE_INVALID_INPUT = "Check the adjustment note and try again.";
export const ADJUSTMENT_NOTE_BODY_REQUIRED = "Adjustment note text is required.";
export const ADJUSTMENT_NOT_FOUND = "Payment adjustment not found.";
export const ADJUSTMENT_ALREADY_CANCELLED = "This payment adjustment is already cancelled.";
export const ADJUSTMENT_CANCEL_INVALID_INPUT = "Check the cancellation details and try again.";
export const ADJUSTMENT_DELETE_FORBIDDEN =
  "Payment adjustment history must not be deleted. Cancel the adjustment instead.";
export const PAYMENT_ADJUST_FORBIDDEN =
  "You do not have permission to modify a confirmed payment via an adjustment workflow.";
