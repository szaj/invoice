export const CHARGEBACK_REQUIRES_SUCCESSFUL_PAYMENT =
  "Only a successful payment can record a chargeback debit or loss.";
export const CHARGEBACK_ALREADY_RECORDED =
  "A chargeback debit or loss already exists for this payment.";
export const CHARGEBACK_INVALID_INPUT = "Check the chargeback details and try again.";
export const CHARGEBACK_SETTLEMENT_AMOUNT_INVALID =
  "Chargeback settlement amount must be a positive decimal string.";
export const CHARGEBACK_EXCEEDS_PAYMENT =
  "Chargeback would exceed the original payment amount after existing refunds and debits.";
export const CHARGEBACK_WON_REQUIRES_DEBIT =
  "A chargeback debit or loss must exist before recording a won or reversal.";
export const CHARGEBACK_WON_ALREADY_RECORDED =
  "A chargeback won or reversal already exists for this payment.";
export const CHARGEBACK_WON_REQUIRES_SUCCESSFUL_PAYMENT =
  "Only a successful payment can record a chargeback won or reversal.";
export const PAYMENT_ADJUST_FORBIDDEN =
  "You do not have permission to modify a confirmed payment via an adjustment workflow.";
