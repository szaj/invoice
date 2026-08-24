import { PAYMENT_ILLEGAL_TRANSITION, type PaymentStatus } from "@/domain/payments/types";

/**
 * Payment status transitions (TASK-045).
 * SUCCESSFUL is terminal for financial lifecycle (BR-004 / BR-005).
 * FAILED is terminal — retries create a new payment record.
 */
const PAYMENT_TRANSITIONS: ReadonlyMap<PaymentStatus, ReadonlySet<PaymentStatus>> = new Map<
  PaymentStatus,
  ReadonlySet<PaymentStatus>
>([
  ["PENDING", new Set<PaymentStatus>(["SUCCESSFUL", "FAILED"])],
  ["SUCCESSFUL", new Set<PaymentStatus>()],
  ["FAILED", new Set<PaymentStatus>()],
]);

export function canTransitionPaymentStatus(from: PaymentStatus, to: PaymentStatus): boolean {
  if (from === to) {
    return false;
  }
  return PAYMENT_TRANSITIONS.get(from)?.has(to) === true;
}

export function assertPaymentStatusTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!canTransitionPaymentStatus(from, to)) {
    throw new Error(PAYMENT_ILLEGAL_TRANSITION);
  }
}
