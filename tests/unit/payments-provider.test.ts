import { createHmac } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { computeConvertedSettlementAmount } from "@/domain/money";
import { assertPaymentProviderCapability } from "@/domain/payments/providers/capabilities";
import {
  PROVIDER_ALREADY_REGISTERED,
  PROVIDER_CAPABILITY_UNSUPPORTED,
  PROVIDER_METHOD_DISABLED,
  PROVIDER_NOT_REGISTERED,
  PROVIDER_WEBHOOK_INVALID,
} from "@/domain/payments/providers/errors";
import {
  PaymentProviderRegistry,
  resolvePaymentProvider,
} from "@/domain/payments/providers/registry";
import type {
  PaymentProvider,
  PaymentProviderGatewayConfig,
} from "@/domain/payments/providers/types";
import { PAYMENT_CONFIRMED_FINANCIAL_FIELDS } from "@/domain/payments/types";
import { createPaymentProviderRegistry } from "@/server/payments/providers/create-payment-provider-registry";
import { FakePaymentAdapter } from "@/server/payments/providers/fake-payment-adapter";
import { ManualPaymentAdapter } from "@/server/payments/providers/manual-payment-adapter";
import { StripePaymentAdapter } from "@/server/payments/providers/stripe/stripe-payment-adapter";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const INVOICE_ID = "22222222-2222-4222-8222-222222222222";
const CUSTOMER_ID = "33333333-3333-4333-8333-333333333333";
const WEBHOOK_SECRET = "test-webhook-secret";

function enabledConfig(
  overrides: Partial<PaymentProviderGatewayConfig> = {},
): PaymentProviderGatewayConfig {
  return {
    companyId: COMPANY_ID,
    methodCode: "MANUAL",
    enabled: true,
    environment: null,
    enabledSettlementCurrencyCodes: ["USD", "AED"],
    credentialsConfigured: false,
    ...overrides,
  };
}

function checkoutInput() {
  return {
    companyId: COMPANY_ID,
    invoiceId: INVOICE_ID,
    customerId: CUSTOMER_ID,
    invoiceCurrencyCode: "GBP",
    invoiceAmountApplied: "100.00",
    settlementCurrencyCode: "USD",
    settlementDecimalPrecision: 2,
    convertedSettlementAmount: "125.00",
    successUrl: "https://app.test/success",
    cancelUrl: "https://app.test/cancel",
  };
}

function collectFiles(directory: string, collected: string[] = []): string[] {
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      collectFiles(full, collected);
    } else if (full.endsWith(".ts") || full.endsWith(".tsx")) {
      collected.push(full);
    }
  }
  return collected;
}

describe("payment provider abstraction (TASK-048 / ADR-008)", () => {
  it("registers Manual, Stripe, and PayPal by default; bank remains later", () => {
    const registry = createPaymentProviderRegistry();
    expect(registry.require("MANUAL")).toBeInstanceOf(ManualPaymentAdapter);
    expect(registry.require("STRIPE")).toBeInstanceOf(StripePaymentAdapter);
    expect(registry.require("PAYPAL").methodCode).toBe("PAYPAL");
    expect(registry.get("BANK_PROCESSOR")).toBeNull();
    expect(() => registry.require("BANK_PROCESSOR")).toThrow(PROVIDER_NOT_REGISTERED);
  });

  it("resolves adapters by method code and company enablement without credentials", () => {
    const registry = createPaymentProviderRegistry();
    const resolved = resolvePaymentProvider(registry, enabledConfig({ methodCode: "STRIPE" }));
    expect(resolved.methodCode).toBe("STRIPE");
    expect(resolved).toBeInstanceOf(StripePaymentAdapter);
    expect(() => resolvePaymentProvider(registry, null)).toThrow(PROVIDER_METHOD_DISABLED);
    expect(() =>
      resolvePaymentProvider(registry, enabledConfig({ methodCode: "STRIPE", enabled: false })),
    ).toThrow(PROVIDER_METHOD_DISABLED);

    const fake = new FakePaymentAdapter({
      methodCode: "PAYPAL",
      webhookSecret: WEBHOOK_SECRET,
    });
    expect(() => new PaymentProviderRegistry().register(fake).register(fake)).toThrow(
      PROVIDER_ALREADY_REGISTERED,
    );
  });

  it("uses capability flags instead of provider-name conditionals", () => {
    const manual = new ManualPaymentAdapter();
    expect(manual.capabilities.supportsWebhooks).toBe(false);
    expect(manual.capabilities.supportsHostedCheckout).toBe(false);
    expect(() => assertPaymentProviderCapability(manual, "supportsWebhooks")).toThrow(
      PROVIDER_CAPABILITY_UNSUPPORTED,
    );

    const stripe = new StripePaymentAdapter({
      credentialResolver: {
        resolveForProvider: async () => {
          throw new Error("unused");
        },
      },
    });
    expect(stripe.capabilities.supportsWebhooks).toBe(true);
    expect(stripe.capabilities.supportsHostedCheckout).toBe(true);
    expect(() => assertPaymentProviderCapability(stripe, "supportsWebhooks")).not.toThrow();
  });

  it("keeps Manual payments on the same domain without fake webhooks", async () => {
    const manual = new ManualPaymentAdapter();
    await expect(manual.createPaymentRequest(checkoutInput())).rejects.toThrow(
      PROVIDER_CAPABILITY_UNSUPPORTED,
    );
    await expect(
      manual.verifyWebhook({ companyId: COMPANY_ID, payload: "{}", headers: {} }),
    ).rejects.toThrow(PROVIDER_CAPABILITY_UNSUPPORTED);
    await expect(
      manual.parseWebhook({ companyId: COMPANY_ID, payload: "{}", headers: {} }),
    ).rejects.toThrow(PROVIDER_CAPABILITY_UNSUPPORTED);
    const health = await manual.healthCheck(enabledConfig());
    expect(health).toEqual({ healthy: true, status: "HEALTHY" });
    const disabled = await manual.healthCheck(enabledConfig({ enabled: false }));
    expect(disabled).toEqual({ healthy: false, status: "DISABLED" });
  });

  it("maps Fake provider statuses to Pending/Successful/Failed and signs webhooks", async () => {
    const fake = new FakePaymentAdapter({
      methodCode: "BANK_PROCESSOR",
      webhookSecret: WEBHOOK_SECRET,
      defaultProcessorFeeAmount: "1.25",
    });
    const created = await fake.createPaymentRequest(checkoutInput());
    expect(created.status).toBe("PENDING");
    expect(created.checkoutUrl).toContain(created.externalTransactionId);
    expect(JSON.stringify(created)).not.toContain(WEBHOOK_SECRET);

    const pending = await fake.getPaymentStatus({
      companyId: COMPANY_ID,
      externalTransactionId: created.externalTransactionId,
    });
    expect(pending.status).toBe("PENDING");

    const payload = JSON.stringify({
      externalEventId: "evt_1",
      externalTransactionId: created.externalTransactionId,
      status: "succeeded",
      processorFeeAmount: "1.25",
    });
    await expect(
      fake.verifyWebhook({
        companyId: COMPANY_ID,
        payload,
        headers: { "x-webhook-signature": "deadbeef" },
      }),
    ).rejects.toThrow(PROVIDER_WEBHOOK_INVALID);

    const signature = fake.signWebhookPayload(payload);
    const parsed = await fake.parseWebhook({
      companyId: COMPANY_ID,
      payload,
      headers: { "x-webhook-signature": signature },
    });
    expect(parsed.status).toBe("SUCCESSFUL");
    expect(parsed.processorFeeAmount).toBe("1.25");
    expect(JSON.stringify(parsed)).not.toContain(WEBHOOK_SECRET);

    const confirmed = await fake.getPaymentStatus({
      companyId: COMPANY_ID,
      externalTransactionId: created.externalTransactionId,
    });
    expect(confirmed.status).toBe("SUCCESSFUL");
  });

  it("does not let retrieved fees change converted settlement", async () => {
    const fake = new FakePaymentAdapter({
      methodCode: "PAYPAL",
      webhookSecret: WEBHOOK_SECRET,
      defaultProcessorFeeAmount: "9.99",
    });
    const created = await fake.createPaymentRequest(checkoutInput());
    const fees = await fake.getFees({
      companyId: COMPANY_ID,
      externalTransactionId: created.externalTransactionId,
    });
    expect(fees.processorFeeAmount).toBe("9.99");

    const converted = computeConvertedSettlementAmount({
      invoiceAmountApplied: "100.00",
      invoiceCurrencyCode: "GBP",
      settlementCurrencyCode: "USD",
      fixedConversionRate: "1.25",
      settlementDecimalPrecision: 2,
      processorFee: fees.processorFeeAmount,
    });
    expect(converted.convertedSettlementAmount.amount).toBe("125");
    expect(converted.convertedSettlementAmount.amount).not.toBe("115.01");
  });

  it("records refunds without rewriting the original provider transaction amounts", async () => {
    const fake = new FakePaymentAdapter({
      methodCode: "PAYPAL",
      webhookSecret: WEBHOOK_SECRET,
    });
    const created = await fake.createPaymentRequest(checkoutInput());
    const refund = await fake.refundPayment({
      companyId: COMPANY_ID,
      externalTransactionId: created.externalTransactionId,
      amount: "10.00",
      settlementCurrencyCode: "USD",
      partial: true,
    });
    expect(refund.amount).toBe("10");
    const status = await fake.getPaymentStatus({
      companyId: COMPANY_ID,
      externalTransactionId: created.externalTransactionId,
    });
    expect(status.status).toBe("PENDING");
  });

  it("allows a later adapter to register without changing the payment record shape", () => {
    const future: PaymentProvider = new FakePaymentAdapter({
      methodCode: "BANK_PROCESSOR",
      webhookSecret: WEBHOOK_SECRET,
    });
    const registry = createPaymentProviderRegistry([future]);
    expect(registry.require("BANK_PROCESSOR").methodCode).toBe("BANK_PROCESSOR");
    expect(PAYMENT_CONFIRMED_FINANCIAL_FIELDS).not.toContain("paypalOrderId");
    expect(PAYMENT_CONFIRMED_FINANCIAL_FIELDS).not.toContain("stripePaymentIntentId");
  });

  it("keeps gateway config and payment records free of secrets", () => {
    const config = enabledConfig({ credentialsConfigured: true, environment: "SANDBOX" });
    expect(Object.keys(config).sort()).toEqual(
      [
        "companyId",
        "credentialsConfigured",
        "enabled",
        "enabledSettlementCurrencyCodes",
        "environment",
        "methodCode",
      ].sort(),
    );
    expect(JSON.stringify(config)).not.toMatch(/secret|apiKey|token|password/i);

    const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
    const gatewayBlock = schema.slice(
      schema.indexOf("model PaymentGatewayConfig {"),
      schema.indexOf("model PaymentGatewaySettlementCurrency {"),
    );
    expect(gatewayBlock).toContain("methodCode");
    expect(gatewayBlock).toContain("enabled");
    expect(gatewayBlock).not.toMatch(/secretKey|apiKey|webhookSecret|encryptedCredential/i);

    const paymentBlock = schema.slice(
      schema.indexOf("model Payment {"),
      schema.indexOf('@@map("payments")'),
    );
    expect(paymentBlock).not.toMatch(/secretKey|apiKey|webhookSecret/i);
    expect(paymentBlock).not.toMatch(/stripePaymentIntent|stripeCheckoutSession|stripeCustomer/i);
  });
});

describe("payment domain is not coupled to a concrete provider SDK (ADR-008)", () => {
  const forbidden =
    /from ["']stripe["']|from ["']@stripe|require\(["']stripe["']\)|from ["']@paypal|paypal-server-sdk|authorizenet/i;

  it("does not import provider SDKs or branch on Stripe in core payment files", () => {
    const roots = [
      resolve(process.cwd(), "src/domain/payments"),
      resolve(process.cwd(), "src/server/payments/payment-service.ts"),
      resolve(process.cwd(), "src/server/payments/payment-repository.ts"),
      resolve(process.cwd(), "src/app/api/payments"),
    ];
    const files = roots.flatMap((root) =>
      statSync(root).isDirectory() ? collectFiles(root) : [root],
    );
    for (const file of files) {
      if (file.includes(`${join("server", "payments", "providers")}`)) {
        continue;
      }
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(forbidden);
      expect(source, file).not.toMatch(
        /\bif\s*\(\s*(?:provider|methodCode)\s*===\s*["']STRIPE["']/,
      );
    }
  });

  it("keeps Stripe SDK import inside the Stripe adapter boundary only", () => {
    const stripeAdapterDir = resolve(process.cwd(), "src/server/payments/providers/stripe");
    const adapterFiles = collectFiles(stripeAdapterDir);
    expect(adapterFiles.some((file) => readFileSync(file, "utf8").match(forbidden))).toBe(true);

    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    expect(pkg.dependencies?.stripe).toBeTruthy();
    expect(
      Object.keys(pkg.dependencies ?? {}).some((name) => /paypal|authorizenet/i.test(name)),
    ).toBe(false);
  });

  it("does not treat a HMAC of a webhook payload as a stored credential", () => {
    const signature = createHmac("sha256", WEBHOOK_SECRET).update("{}").digest("hex");
    expect(signature).not.toBe(WEBHOOK_SECRET);
  });
});
