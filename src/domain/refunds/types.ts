export const REFUND_REQUIRES_SUCCESSFUL_PAYMENT = "Only a successful payment can be refunded.";
export const REFUND_ALREADY_PROCESSED = "A processed refund already exists for this payment.";
export const REFUND_INVALID_INPUT = "Check the refund details and try again.";
export const REFUND_SETTLEMENT_AMOUNT_INVALID =
  "Refund settlement amount must be a positive decimal string.";
export const REFUND_AMOUNT_INVALID = "Partial refund amount must be a positive decimal string.";
export const REFUND_EXCEEDS_PAYMENT =
  "Refund would exceed the original payment amount. Over-refund is rejected by default.";
export const REFUND_PROVIDER_FAILED = "The payment provider could not process the refund.";
export const PAYMENT_ADJUST_FORBIDDEN =
  "You do not have permission to modify a confirmed payment via an adjustment workflow.";
