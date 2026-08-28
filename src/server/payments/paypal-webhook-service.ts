import "server-only";

import { randomUUID } from "node:crypto";

import { logger } from "@/lib/logger";
import { companyIdSchema } from "@/domain/companies/company-schema";
import {
  PAYMENT_EVENT_INVALID,
  PAYMENT_WEBHOOK_UNAVAILABLE,
  type PaymentEventRecord,
} from "@/domain/payments/events/types";
import {
  PROVIDER_CONFIGURATION_ERROR,
  PROVIDER_CREDENTIALS_MISSING,
  PROVIDER_EVENT_UNSUPPORTED,
  PROVIDER_INVALID_RESPONSE,
  PROVIDER_METHOD_DISABLED,
  PROVIDER_WEBHOOK_INVALID,
} from "@/domain/payments/providers/errors";
import type { PaymentProviderRegistry } from "@/domain/payments/providers/registry";
import { createPaymentProviderRegistry } from "@/server/payments/providers/create-payment-provider-registry";
import { PrismaPaymentEventStore } from "@/server/payments/payment-event-repository";
import {
  applyGatewayWebhookPaymentStatus,
  createDefaultPaymentServiceDependencies,
  type PaymentServiceDependencies,
} from "@/server/payments/payment-service";
import {
  InlinePayPalWebhookJobDispatcher,
  type PayPalWebhookJobDispatcher,
  type PayPalWebhookProcessingJob,
  type PayPalWebhookProcessingResult,
} from "@/server/payments/paypal-webhook-queue";
import { emitOperationalNotification } from "@/server/notifications/notification-service";
import { isQueueEnabled } from "@/server/queue/config";
import { createPayPalWebhookBullMqDispatcher } from "@/server/queue/dispatchers";

export type ProcessPayPalWebhookResult =
  | { ok: true; status: 200; data: PayPalWebhookProcessingResult }
  | { ok: false; status: 400 | 401 | 503; error: string };

export interface PayPalWebhookServiceDependencies {
  readonly events?: PrismaPaymentEventStore;
  readonly paymentDeps?: PaymentServiceDependencies;
  readonly providerRegistry?: PaymentProviderRegistry;
  readonly dispatcher?: PayPalWebhookJobDispatcher;
}

function eventsOf(deps: PayPalWebhookServiceDependencies): PrismaPaymentEventStore {
  return deps.events ?? new PrismaPaymentEventStore();
}

function paymentDepsOf(deps: PayPalWebhookServiceDependencies): PaymentServiceDependencies {
  return deps.paymentDeps ?? createDefaultPaymentServiceDependencies();
}

function registryOf(deps: PayPalWebhookServiceDependencies): PaymentProviderRegistry {
  return deps.providerRegistry ?? createPaymentProviderRegistry();
}

function dispatcherOf(deps: PayPalWebhookServiceDependencies): PayPalWebhookJobDispatcher {
  if (deps.dispatcher) {
    return deps.dispatcher;
  }
  const processFn = (job: PayPalWebhookProcessingJob) => processPayPalWebhookJob(job, deps);
  if (isQueueEnabled()) {
    return createPayPalWebhookBullMqDispatcher();
  }
  return new InlinePayPalWebhookJobDispatcher(processFn);
}

async function notifyGatewayWebhookFailure(
  companyIdInput: string,
  message: string,
  failureType: "WEBHOOK" | "CONFIGURATION",
): Promise<void> {
  const companyParsed = companyIdSchema.safeParse(companyIdInput);
  await emitOperationalNotification({
    kind: "GATEWAY_FAILURE",
    companyId: companyParsed.success ? companyParsed.data : null,
    methodCode: "PAYPAL",
    failureType,
    message: message.slice(0, 500),
  });
}

export async function processPayPalWebhookJob(
  job: PayPalWebhookProcessingJob,
  deps: PayPalWebhookServiceDependencies,
): Promise<PayPalWebhookProcessingResult> {
  const provider = registryOf(deps).require("PAYPAL");
  const parsed = await provider.parseWebhook({
    companyId: job.companyId,
    payload: job.payload,
    headers: job.headers,
  });

  const created = await eventsOf(deps).tryCreate({
    companyId: job.companyId,
    methodCode: "PAYPAL",
    externalEventId: parsed.externalEventId,
    externalTransactionId: parsed.externalTransactionId,
    normalizedStatus: parsed.status,
    processorFeeAmount: parsed.processorFeeAmount,
    processingStatus: "RECEIVED",
    correlationId: job.correlationId,
  });

  if (!created) {
    const existing = await eventsOf(deps).findByExternalEventId("PAYPAL", parsed.externalEventId);
    logger.info(
      {
        event: "payments.webhook_duplicate",
        companyId: job.companyId,
        methodCode: "PAYPAL",
        externalEventId: parsed.externalEventId,
        correlationId: job.correlationId,
        paymentEventId: existing?.id ?? null,
      },
      "Duplicate PayPal webhook ignored",
    );
    return {
      duplicate: true,
      outcome: "duplicate",
      paymentEventId: existing?.id ?? null,
      paymentId: existing?.paymentId ?? null,
    };
  }

  if (parsed.status === "PENDING") {
    const updated = await markEvent(deps, created, {
      processingStatus: "IGNORED",
      errorMessage: null,
    });
    return {
      duplicate: false,
      outcome: "ignored",
      paymentEventId: updated.id,
      paymentId: null,
    };
  }

  const applied = await applyGatewayWebhookPaymentStatus(
    {
      companyId: job.companyId,
      methodCode: "PAYPAL",
      externalTransactionId: parsed.externalTransactionId,
      status: parsed.status,
      correlationId: job.correlationId,
    },
    paymentDepsOf(deps),
  );

  if (!applied.ok) {
    await markEvent(deps, created, {
      processingStatus: "FAILED",
      errorMessage: applied.error.slice(0, 200),
    });
    throw new Error(applied.error);
  }

  const outcome = applied.data.outcome;
  const paymentId = applied.data.payment?.id ?? null;
  const processingStatus =
    outcome === "not_found" ? "IGNORED" : outcome === "pending_noop" ? "IGNORED" : "PROCESSED";

  const updated = await markEvent(deps, created, {
    paymentId,
    processingStatus,
    errorMessage:
      outcome === "not_found" ? "No matching PENDING payment for external transaction." : null,
  });

  logger.info(
    {
      event: "payments.webhook_processed",
      companyId: job.companyId,
      methodCode: "PAYPAL",
      externalEventId: parsed.externalEventId,
      externalTransactionId: parsed.externalTransactionId,
      correlationId: job.correlationId,
      paymentEventId: updated.id,
      paymentId,
      outcome,
    },
    "PayPal webhook processed",
  );

  return {
    duplicate: false,
    outcome,
    paymentEventId: updated.id,
    paymentId,
  };
}

async function markEvent(
  deps: PayPalWebhookServiceDependencies,
  event: PaymentEventRecord,
  patch: {
    readonly paymentId?: string | null;
    readonly processingStatus: PaymentEventRecord["processingStatus"];
    readonly errorMessage: string | null;
  },
): Promise<PaymentEventRecord> {
  const updated = await eventsOf(deps).update(event.id, {
    paymentId: patch.paymentId,
    processingStatus: patch.processingStatus,
    errorMessage: patch.errorMessage,
    processedAt: new Date(),
  });
  return updated ?? event;
}

/**
 * PayPal webhook entry: verify/parse via adapter, persist payment_events, apply status idempotently.
 */
export async function processPayPalWebhook(
  companyIdInput: string,
  payload: string,
  headers: Readonly<Record<string, string | string[] | undefined>>,
  deps: PayPalWebhookServiceDependencies = {},
): Promise<ProcessPayPalWebhookResult> {
  const correlationId = randomUUID();
  try {
    const companyIdParsed = companyIdSchema.safeParse(companyIdInput);
    if (!companyIdParsed.success) {
      return { ok: false, status: 400, error: PAYMENT_EVENT_INVALID };
    }
    const companyId = companyIdParsed.data;

    if (!payload || payload.trim().length === 0) {
      return { ok: false, status: 400, error: PAYMENT_EVENT_INVALID };
    }

    const dispatcher = dispatcherOf(deps);

    const data = await dispatcher.dispatch({
      companyId,
      payload,
      headers,
      correlationId,
    });

    return { ok: true, status: 200, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    logger.error(
      {
        event: "payments.webhook_failed",
        companyId: companyIdInput,
        methodCode: "PAYPAL",
        correlationId,
        err: message.slice(0, 200),
      },
      "PayPal webhook processing failed",
    );

    if (
      message === PROVIDER_WEBHOOK_INVALID ||
      message === PROVIDER_CREDENTIALS_MISSING ||
      message === PROVIDER_CONFIGURATION_ERROR ||
      message === PROVIDER_METHOD_DISABLED
    ) {
      await notifyGatewayWebhookFailure(companyIdInput, message, "CONFIGURATION");
      return { ok: false, status: 401, error: PROVIDER_WEBHOOK_INVALID };
    }
    if (message === PROVIDER_EVENT_UNSUPPORTED) {
      return {
        ok: true,
        status: 200,
        data: {
          duplicate: false,
          outcome: "ignored",
          paymentEventId: null,
          paymentId: null,
        },
      };
    }
    if (message === PROVIDER_INVALID_RESPONSE || message === PAYMENT_EVENT_INVALID) {
      return { ok: false, status: 400, error: PAYMENT_EVENT_INVALID };
    }
    await notifyGatewayWebhookFailure(companyIdInput, message, "WEBHOOK");
    return { ok: false, status: 503, error: PAYMENT_WEBHOOK_UNAVAILABLE };
  }
}
