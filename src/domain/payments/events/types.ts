import type { PaymentStatus } from "@/domain/payments/types";
import type { PaymentMethodCode } from "@/domain/settlement/types";

export const PAYMENT_EVENT_PROCESSING_STATUSES = [
  "RECEIVED",
  "PROCESSED",
  "IGNORED",
  "FAILED",
] as const;

export type PaymentEventProcessingStatus = (typeof PAYMENT_EVENT_PROCESSING_STATUSES)[number];

export type PaymentEventRecord = {
  readonly id: string;
  readonly companyId: string;
  readonly methodCode: PaymentMethodCode;
  readonly paymentId: string | null;
  readonly externalEventId: string;
  readonly externalTransactionId: string | null;
  readonly normalizedStatus: PaymentStatus | null;
  readonly processorFeeAmount: string | null;
  readonly processingStatus: PaymentEventProcessingStatus;
  readonly correlationId: string;
  readonly errorMessage: string | null;
  readonly processedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export const PAYMENT_EVENT_DUPLICATE = "Payment webhook event was already processed.";
export const PAYMENT_EVENT_INVALID = "Check the payment webhook event and try again.";
export const PAYMENT_WEBHOOK_UNAVAILABLE = "Payment webhook processing is temporarily unavailable.";
