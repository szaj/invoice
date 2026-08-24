import type { PaymentStatus } from "@/domain/payments/types";
import {
  PROVIDER_EVENT_UNSUPPORTED,
  PROVIDER_INVALID_RESPONSE,
} from "@/domain/payments/providers/errors";

/**
 * Verified PayPal webhook event shape used for payment lifecycle mapping (TASK-055).
 * Correlation uses the Orders v2 order id stored as `payments.external_transaction_id`.
 */
export type PayPalWebhookEvent = {
  readonly id: string;
  readonly event_type: string;
  readonly resource?: Record<string, unknown> | null;
};

/**
 * Map a verified PayPal webhook event into provider-neutral payment fields.
 * Only order/capture payment lifecycle events are owned by TASK-054/055.
 * Fees are not applied to converted settlement or invoice balance (BR-020).
 */
export function mapPayPalWebhookEvent(event: PayPalWebhookEvent): {
  readonly externalEventId: string;
  readonly externalTransactionId: string;
  readonly status: PaymentStatus;
  readonly processorFeeAmount: string | null;
} {
  if (typeof event.id !== "string" || event.id.trim() === "") {
    throw new Error(PROVIDER_INVALID_RESPONSE);
  }

  const resource = event.resource;
  if (!resource || typeof resource !== "object") {
    throw new Error(PROVIDER_INVALID_RESPONSE);
  }

  switch (event.event_type) {
    case "CHECKOUT.ORDER.APPROVED": {
      const orderId = asString(resource.id);
      if (!orderId) {
        throw new Error(PROVIDER_INVALID_RESPONSE);
      }
      return {
        externalEventId: event.id,
        externalTransactionId: orderId,
        status: "PENDING",
        processorFeeAmount: null,
      };
    }
    case "CHECKOUT.ORDER.COMPLETED": {
      const orderId = asString(resource.id);
      if (!orderId) {
        throw new Error(PROVIDER_INVALID_RESPONSE);
      }
      return {
        externalEventId: event.id,
        externalTransactionId: orderId,
        status: "SUCCESSFUL",
        processorFeeAmount: null,
      };
    }
    case "CHECKOUT.ORDER.VOIDED": {
      const orderId = asString(resource.id);
      if (!orderId) {
        throw new Error(PROVIDER_INVALID_RESPONSE);
      }
      return {
        externalEventId: event.id,
        externalTransactionId: orderId,
        status: "FAILED",
        processorFeeAmount: null,
      };
    }
    case "PAYMENT.CAPTURE.COMPLETED": {
      const orderId = orderIdFromCaptureResource(resource);
      if (!orderId) {
        throw new Error(PROVIDER_INVALID_RESPONSE);
      }
      return {
        externalEventId: event.id,
        externalTransactionId: orderId,
        status: "SUCCESSFUL",
        processorFeeAmount: null,
      };
    }
    case "PAYMENT.CAPTURE.DENIED":
    case "PAYMENT.CAPTURE.DECLINED": {
      const orderId = orderIdFromCaptureResource(resource);
      if (!orderId) {
        throw new Error(PROVIDER_INVALID_RESPONSE);
      }
      return {
        externalEventId: event.id,
        externalTransactionId: orderId,
        status: "FAILED",
        processorFeeAmount: null,
      };
    }
    case "PAYMENT.CAPTURE.PENDING": {
      const orderId = orderIdFromCaptureResource(resource);
      if (!orderId) {
        throw new Error(PROVIDER_INVALID_RESPONSE);
      }
      return {
        externalEventId: event.id,
        externalTransactionId: orderId,
        status: "PENDING",
        processorFeeAmount: null,
      };
    }
    default:
      // Verified but not a payment lifecycle event owned by this adapter.
      throw new Error(PROVIDER_EVENT_UNSUPPORTED);
  }
}

function orderIdFromCaptureResource(resource: Record<string, unknown>): string | null {
  const supplementary = resource.supplementary_data;
  if (supplementary && typeof supplementary === "object") {
    const related = (supplementary as Record<string, unknown>).related_ids;
    if (related && typeof related === "object") {
      const orderId = asString((related as Record<string, unknown>).order_id);
      if (orderId) {
        return orderId;
      }
    }
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
