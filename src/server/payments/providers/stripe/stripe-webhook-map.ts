import type { PaymentStatus } from "@/domain/payments/types";
import type { StripeWebhookEvent } from "@/server/payments/providers/stripe/stripe-client";
import {
  PROVIDER_EVENT_UNSUPPORTED,
  PROVIDER_INVALID_RESPONSE,
} from "@/domain/payments/providers/errors";

/**
 * Map a verified Stripe webhook event into provider-neutral payment fields.
 * Only Checkout Session payment lifecycle events are owned by TASK-052/053.
 */
export function mapStripeWebhookEvent(event: StripeWebhookEvent): {
  readonly externalEventId: string;
  readonly externalTransactionId: string;
  readonly status: PaymentStatus;
  readonly processorFeeAmount: string | null;
} {
  if (typeof event.id !== "string" || event.id.trim() === "") {
    throw new Error(PROVIDER_INVALID_RESPONSE);
  }

  const object = event.data?.object;
  if (!object || typeof object !== "object") {
    throw new Error(PROVIDER_INVALID_RESPONSE);
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const sessionId = asString(object.id);
      if (!sessionId) {
        throw new Error(PROVIDER_INVALID_RESPONSE);
      }
      const paymentStatus = asString(object.payment_status);
      if (paymentStatus === "paid" || paymentStatus === "no_payment_required") {
        return {
          externalEventId: event.id,
          externalTransactionId: sessionId,
          status: "SUCCESSFUL",
          processorFeeAmount: null,
        };
      }
      if (paymentStatus === "unpaid") {
        return {
          externalEventId: event.id,
          externalTransactionId: sessionId,
          status: "PENDING",
          processorFeeAmount: null,
        };
      }
      throw new Error(PROVIDER_INVALID_RESPONSE);
    }
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      const sessionId = asString(object.id);
      if (!sessionId) {
        throw new Error(PROVIDER_INVALID_RESPONSE);
      }
      return {
        externalEventId: event.id,
        externalTransactionId: sessionId,
        status: "FAILED",
        processorFeeAmount: null,
      };
    }
    default:
      // Verified but not a payment lifecycle event owned by this adapter.
      throw new Error(PROVIDER_EVENT_UNSUPPORTED);
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
