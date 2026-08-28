import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { PROVIDER_WEBHOOK_INVALID } from "@/domain/payments/providers/errors";
import { processPayPalWebhook } from "@/server/payments/paypal-webhook-service";
import { processStripeWebhook } from "@/server/payments/stripe-webhook-service";
import {
  createPayPalWebhookRegistry,
  createStripeWebhookRegistry,
  createWebhookPaymentDeps,
  memoryPaymentEventStore,
  paypalCaptureCompletedPayload,
  paypalCaptureDeniedPayload,
  paypalOrderApprovedPayload,
  paypalVerifiedHeaders,
  pendingWebhookPayment,
  stripeCheckoutCompletedPayload,
  stripeCheckoutExpiredPayload,
  stripeSign,
  WEBHOOK_COMPANY_ID,
  WEBHOOK_PAYMENT_ID,
} from "../helpers/webhook-fixtures";

function walkFiles(directory: string, predicate: (file: string) => boolean): string[] {
  if (!existsSync(directory)) {
    return [];
  }

  const entries = readdirSync(directory);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...walkFiles(fullPath, predicate));
      continue;
    }
    if (predicate(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

function uncommented(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
}

describe("webhook suite (TASK-095 / E2E-10)", () => {
  describe("signature validation — unsigned rejected", () => {
    it("rejects unsigned Stripe webhooks with 401", async () => {
      const events = memoryPaymentEventStore();
      const payload = stripeCheckoutCompletedPayload("evt_unsigned", "cs_test_1");
      const result = await processStripeWebhook(
        WEBHOOK_COMPANY_ID,
        payload,
        {},
        {
          events,
          providerRegistry: createStripeWebhookRegistry(),
          paymentDeps: createWebhookPaymentDeps(pendingWebhookPayment("STRIPE")).deps,
        },
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(401);
        expect(result.error).toBe(PROVIDER_WEBHOOK_INVALID);
      }
      expect(events.rows).toHaveLength(0);
    });

    it("rejects unsigned PayPal webhooks with 401", async () => {
      const events = memoryPaymentEventStore();
      const payload = paypalCaptureCompletedPayload("evt_unsigned", "ORDER-1");
      const result = await processPayPalWebhook(
        WEBHOOK_COMPANY_ID,
        payload,
        {},
        {
          events,
          providerRegistry: createPayPalWebhookRegistry(),
          paymentDeps: createWebhookPaymentDeps(pendingWebhookPayment("PAYPAL")).deps,
        },
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(401);
        expect(result.error).toBe(PROVIDER_WEBHOOK_INVALID);
      }
      expect(events.rows).toHaveLength(0);
    });
  });

  describe("E2E-10 — duplicate delivery never duplicates payments", () => {
    it("confirms Stripe once and treats identical event IDs as duplicates", async () => {
      const events = memoryPaymentEventStore();
      const harness = createWebhookPaymentDeps(pendingWebhookPayment("STRIPE"));
      const payload = stripeCheckoutCompletedPayload("evt_dup", "cs_test_1");
      const headers = { "stripe-signature": stripeSign(payload) };
      const deps = {
        events,
        providerRegistry: createStripeWebhookRegistry(),
        paymentDeps: harness.deps,
      };

      const first = await processStripeWebhook(WEBHOOK_COMPANY_ID, payload, headers, deps);
      expect(first.ok).toBe(true);
      if (first.ok) {
        expect(first.data.outcome).toBe("confirmed");
        expect(first.data.paymentId).toBe(WEBHOOK_PAYMENT_ID);
        expect(first.data.duplicate).toBe(false);
      }
      expect(harness.getPayment().status).toBe("SUCCESSFUL");
      expect(events.rows).toHaveLength(1);
      expect(harness.getCreatePaymentCalls()).toBe(0);

      const second = await processStripeWebhook(WEBHOOK_COMPANY_ID, payload, headers, deps);
      expect(second.ok).toBe(true);
      if (second.ok) {
        expect(second.data.duplicate).toBe(true);
        expect(second.data.outcome).toBe("duplicate");
      }
      expect(events.rows).toHaveLength(1);
      expect(harness.getPayment().status).toBe("SUCCESSFUL");
      expect(harness.getCreatePaymentCalls()).toBe(0);
    });

    it("confirms PayPal once and treats identical event IDs as duplicates", async () => {
      const events = memoryPaymentEventStore();
      const harness = createWebhookPaymentDeps(pendingWebhookPayment("PAYPAL"));
      const payload = paypalCaptureCompletedPayload("evt_dup", "ORDER-1");
      const headers = paypalVerifiedHeaders();
      const deps = {
        events,
        providerRegistry: createPayPalWebhookRegistry(),
        paymentDeps: harness.deps,
      };

      const first = await processPayPalWebhook(WEBHOOK_COMPANY_ID, payload, headers, deps);
      expect(first.ok).toBe(true);
      if (first.ok) {
        expect(first.data.outcome).toBe("confirmed");
        expect(first.data.paymentId).toBe(WEBHOOK_PAYMENT_ID);
      }
      expect(harness.getPayment().status).toBe("SUCCESSFUL");

      const second = await processPayPalWebhook(WEBHOOK_COMPANY_ID, payload, headers, deps);
      expect(second.ok).toBe(true);
      if (second.ok) {
        expect(second.data.duplicate).toBe(true);
        expect(second.data.outcome).toBe("duplicate");
      }
      expect(events.rows).toHaveLength(1);
      expect(harness.getCreatePaymentCalls()).toBe(0);
    });

    it("does not create a second payment when a new SUCCESS event arrives after confirmation", async () => {
      const events = memoryPaymentEventStore();
      const harness = createWebhookPaymentDeps(pendingWebhookPayment("STRIPE"));
      const deps = {
        events,
        providerRegistry: createStripeWebhookRegistry(),
        paymentDeps: harness.deps,
      };

      const firstPayload = stripeCheckoutCompletedPayload("evt_success_1", "cs_test_1");
      const first = await processStripeWebhook(
        WEBHOOK_COMPANY_ID,
        firstPayload,
        {
          "stripe-signature": stripeSign(firstPayload),
        },
        deps,
      );
      expect(first.ok).toBe(true);
      expect(harness.getPayment().status).toBe("SUCCESSFUL");

      const secondPayload = stripeCheckoutCompletedPayload("evt_success_2", "cs_test_1");
      const second = await processStripeWebhook(
        WEBHOOK_COMPANY_ID,
        secondPayload,
        {
          "stripe-signature": stripeSign(secondPayload),
        },
        deps,
      );
      expect(second.ok).toBe(true);
      if (second.ok) {
        expect(second.data.duplicate).toBe(false);
        expect(second.data.outcome).toBe("already_terminal");
      }
      expect(events.rows).toHaveLength(2);
      expect(harness.getPayment().status).toBe("SUCCESSFUL");
      expect(harness.getCreatePaymentCalls()).toBe(0);
    });
  });

  describe("safe retries", () => {
    it("returns duplicate on provider retry of the same Stripe event ID", async () => {
      const events = memoryPaymentEventStore();
      const harness = createWebhookPaymentDeps(pendingWebhookPayment("STRIPE"));
      const payload = stripeCheckoutCompletedPayload("evt_retry", "cs_test_1");
      const headers = { "stripe-signature": stripeSign(payload) };
      const deps = {
        events,
        providerRegistry: createStripeWebhookRegistry(),
        paymentDeps: harness.deps,
      };

      await processStripeWebhook(WEBHOOK_COMPANY_ID, payload, headers, deps);
      const retry = await processStripeWebhook(WEBHOOK_COMPANY_ID, payload, headers, deps);

      expect(retry.ok).toBe(true);
      if (retry.ok) {
        expect(retry.data.duplicate).toBe(true);
        expect(retry.data.outcome).toBe("duplicate");
      }
      expect(events.rows).toHaveLength(1);
      expect(harness.getPayment().status).toBe("SUCCESSFUL");
    });
  });

  describe("out-of-order events", () => {
    it("keeps Stripe payment SUCCESSFUL when a later FAILED event arrives", async () => {
      const events = memoryPaymentEventStore();
      const harness = createWebhookPaymentDeps(pendingWebhookPayment("STRIPE"));
      const deps = {
        events,
        providerRegistry: createStripeWebhookRegistry(),
        paymentDeps: harness.deps,
      };

      const successPayload = stripeCheckoutCompletedPayload("evt_success", "cs_test_1");
      await processStripeWebhook(
        WEBHOOK_COMPANY_ID,
        successPayload,
        {
          "stripe-signature": stripeSign(successPayload),
        },
        deps,
      );
      expect(harness.getPayment().status).toBe("SUCCESSFUL");

      const failedPayload = stripeCheckoutExpiredPayload("evt_failed_later", "cs_test_1");
      const failed = await processStripeWebhook(
        WEBHOOK_COMPANY_ID,
        failedPayload,
        {
          "stripe-signature": stripeSign(failedPayload),
        },
        deps,
      );
      expect(failed.ok).toBe(true);
      if (failed.ok) {
        expect(failed.data.outcome).toBe("already_terminal");
      }
      expect(harness.getPayment().status).toBe("SUCCESSFUL");
      expect(events.rows).toHaveLength(2);
    });

    it("ignores late PayPal PENDING events after payment is SUCCESSFUL", async () => {
      const events = memoryPaymentEventStore();
      const harness = createWebhookPaymentDeps(pendingWebhookPayment("PAYPAL"));
      const deps = {
        events,
        providerRegistry: createPayPalWebhookRegistry(),
        paymentDeps: harness.deps,
      };

      const successPayload = paypalCaptureCompletedPayload("evt_success", "ORDER-1");
      await processPayPalWebhook(WEBHOOK_COMPANY_ID, successPayload, paypalVerifiedHeaders(), deps);
      expect(harness.getPayment().status).toBe("SUCCESSFUL");

      const pendingPayload = paypalOrderApprovedPayload("evt_pending_late", "ORDER-1");
      const pending = await processPayPalWebhook(
        WEBHOOK_COMPANY_ID,
        pendingPayload,
        paypalVerifiedHeaders(),
        deps,
      );
      expect(pending.ok).toBe(true);
      if (pending.ok) {
        expect(pending.data.outcome).toBe("ignored");
      }
      expect(harness.getPayment().status).toBe("SUCCESSFUL");
    });

    it("does not revert SUCCESSFUL to FAILED when PayPal sends a late denial", async () => {
      const events = memoryPaymentEventStore();
      const harness = createWebhookPaymentDeps(pendingWebhookPayment("PAYPAL"));
      const deps = {
        events,
        providerRegistry: createPayPalWebhookRegistry(),
        paymentDeps: harness.deps,
      };

      const successPayload = paypalCaptureCompletedPayload("evt_success", "ORDER-1");
      await processPayPalWebhook(WEBHOOK_COMPANY_ID, successPayload, paypalVerifiedHeaders(), deps);

      const deniedPayload = paypalCaptureDeniedPayload("evt_denied_late", "ORDER-1");
      const denied = await processPayPalWebhook(
        WEBHOOK_COMPANY_ID,
        deniedPayload,
        paypalVerifiedHeaders(),
        deps,
      );
      expect(denied.ok).toBe(true);
      if (denied.ok) {
        expect(denied.data.outcome).toBe("already_terminal");
      }
      expect(harness.getPayment().status).toBe("SUCCESSFUL");
      expect(events.rows).toHaveLength(2);
    });
  });

  describe("orphan events never create payments", () => {
    it("stores Stripe orphan events as IGNORED without creating payments", async () => {
      const events = memoryPaymentEventStore();
      const harness = createWebhookPaymentDeps(pendingWebhookPayment("STRIPE"));
      const payload = stripeCheckoutCompletedPayload("evt_orphan", "cs_missing");
      const result = await processStripeWebhook(
        WEBHOOK_COMPANY_ID,
        payload,
        { "stripe-signature": stripeSign(payload) },
        {
          events,
          providerRegistry: createStripeWebhookRegistry(),
          paymentDeps: {
            ...harness.deps,
            payments: {
              ...harness.deps.payments,
              getPaymentByExternalTransaction: async () => null,
              listPayments: async () => [],
            },
          },
        },
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.outcome).toBe("not_found");
        expect(result.data.paymentId).toBeNull();
      }
      expect(events.rows).toHaveLength(1);
      expect(events.rows[0]?.processingStatus).toBe("IGNORED");
      expect(harness.getCreatePaymentCalls()).toBe(0);
    });
  });

  describe("payment_events idempotency boundary", () => {
    it("enforces unique (methodCode, externalEventId) in the memory harness", async () => {
      const events = memoryPaymentEventStore();
      const first = await events.tryCreate({
        companyId: WEBHOOK_COMPANY_ID,
        methodCode: "STRIPE",
        externalEventId: "evt_unique",
        externalTransactionId: "cs_1",
        correlationId: "corr-1",
      });
      const duplicate = await events.tryCreate({
        companyId: WEBHOOK_COMPANY_ID,
        methodCode: "STRIPE",
        externalEventId: "evt_unique",
        externalTransactionId: "cs_1",
        correlationId: "corr-2",
      });

      expect(first).not.toBeNull();
      expect(duplicate).toBeNull();
      expect(events.rows).toHaveLength(1);
    });
  });

  describe("webhook route handler boundary", () => {
    const webhookRoot = path.join(process.cwd(), "src", "app", "api", "webhooks");

    it("delegates to provider webhook services without session RBAC", () => {
      const routeFiles = walkFiles(webhookRoot, (file) => file.endsWith(`${path.sep}route.ts`));
      expect(routeFiles.length).toBeGreaterThanOrEqual(2);

      for (const file of routeFiles) {
        const source = uncommented(readFileSync(file, "utf8"));
        expect(source).not.toContain("getRequestAuthorizationPrincipal");
        expect(source).not.toContain("requirePermission");
        expect(
          source.includes("processStripeWebhook") || source.includes("processPayPalWebhook"),
        ).toBe(true);
      }
    });
  });

  describe("webhook service source boundary", () => {
    const serviceFiles = [
      path.join(process.cwd(), "src", "server", "payments", "stripe-webhook-service.ts"),
      path.join(process.cwd(), "src", "server", "payments", "paypal-webhook-service.ts"),
    ];

    it("does not create payments inside webhook services", () => {
      for (const file of serviceFiles) {
        const source = uncommented(readFileSync(file, "utf8"));
        expect(source).not.toContain("createPayment(");
        expect(source).toContain("applyGatewayWebhookPaymentStatus");
        expect(source).toContain("tryCreate");
      }
    });
  });
});
