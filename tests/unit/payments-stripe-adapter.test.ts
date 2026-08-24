import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { computeConvertedSettlementAmount, toProviderAmountInteger } from "@/domain/money";
import {
  PROVIDER_CAPABILITY_UNSUPPORTED,
  PROVIDER_CONFIGURATION_ERROR,
  PROVIDER_CREDENTIALS_MISSING,
  PROVIDER_INVALID_RESPONSE,
  PROVIDER_METHOD_DISABLED,
  PROVIDER_WEBHOOK_INVALID,
} from "@/domain/payments/providers/errors";
import { resolvePaymentProvider } from "@/domain/payments/providers/registry";
import type { PaymentProviderGatewayConfig } from "@/domain/payments/providers/types";
import { createPaymentProviderRegistry } from "@/server/payments/providers/create-payment-provider-registry";
import { ManualPaymentAdapter } from "@/server/payments/providers/manual-payment-adapter";
import type {
  StripeApiClient,
  StripeCheckoutSession,
} from "@/server/payments/providers/stripe/stripe-client";
import {
  assertStripeSecretMatchesEnvironment,
  parseStripeCredentials,
} from "@/server/payments/providers/stripe/stripe-credentials";
import {
  buildStripePaymentRequestIdempotencyKey,
  StripePaymentAdapter,
} from "@/server/payments/providers/stripe/stripe-payment-adapter";
import type { GatewayCredentialResolver } from "@/server/gateway-credentials/resolve-gateway-credentials";

const COMPANY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COMPANY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const INVOICE_ID = "22222222-2222-4222-8222-222222222222";
const CUSTOMER_ID = "33333333-3333-4333-8333-333333333333";
const SECRET_A = "sk_test_company_a_secret_value";
const SECRET_B = "sk_test_company_b_secret_value";
const WEBHOOK_A = "whsec_company_a";

function checkoutInput(overrides: Record<string, unknown> = {}) {
  return {
    companyId: COMPANY_A,
    invoiceId: INVOICE_ID,
    customerId: CUSTOMER_ID,
    invoiceCurrencyCode: "GBP",
    invoiceAmountApplied: "100.00",
    settlementCurrencyCode: "USD",
    settlementDecimalPrecision: 2,
    convertedSettlementAmount: "125.00",
    successUrl: "https://app.test/success",
    cancelUrl: "https://app.test/cancel",
    ...overrides,
  };
}

function stripeConfig(
  overrides: Partial<PaymentProviderGatewayConfig> = {},
): PaymentProviderGatewayConfig {
  return {
    companyId: COMPANY_A,
    methodCode: "STRIPE",
    enabled: true,
    environment: "SANDBOX",
    enabledSettlementCurrencyCodes: ["USD", "AED"],
    credentialsConfigured: true,
    ...overrides,
  };
}

function resolverFor(
  map: Record<
    string,
    {
      secretKey: string;
      webhookSecret?: string;
      environment?: "SANDBOX" | "LIVE";
      enabled?: boolean;
    }
  >,
): GatewayCredentialResolver {
  return {
    async resolveForProvider({ companyId, methodCode }) {
      if (methodCode !== "STRIPE") {
        throw new Error(PROVIDER_METHOD_DISABLED);
      }
      const entry = map[companyId];
      if (!entry || entry.enabled === false) {
        throw new Error(PROVIDER_METHOD_DISABLED);
      }
      return {
        companyId,
        methodCode: "STRIPE",
        enabled: true,
        environment: entry.environment ?? "SANDBOX",
        credentialsConfigured: true as const,
        enabledSettlementCurrencyCodes: ["USD"],
        credentials: {
          apiSecret: entry.secretKey,
          webhookSecret: entry.webhookSecret ?? WEBHOOK_A,
        },
      };
    },
  };
}

function createFakeStripeClient(options?: {
  onCreate?: (params: unknown, requestOptions: unknown, secretKey: string) => StripeCheckoutSession;
  onRetrieve?: (id: string, secretKey: string) => StripeCheckoutSession;
  onConstructEvent?: (
    payload: string,
    header: string,
    secret: string,
  ) => {
    id: string;
    type: string;
    data: { object: Record<string, unknown> };
  };
}): { factory: (secretKey: string) => StripeApiClient; createCalls: unknown[] } {
  const createCalls: unknown[] = [];
  const factory = (secretKey: string): StripeApiClient => ({
    checkout: {
      sessions: {
        create: async (params, requestOptions) => {
          createCalls.push({ secretKey, params, requestOptions });
          if (options?.onCreate) {
            return options.onCreate(params, requestOptions, secretKey);
          }
          return {
            id: "cs_test_123",
            url: "https://checkout.stripe.test/cs_test_123",
            status: "open",
            payment_status: "unpaid",
          };
        },
        retrieve: async (id) => {
          if (options?.onRetrieve) {
            return options.onRetrieve(id, secretKey);
          }
          return {
            id,
            url: null,
            status: "open",
            payment_status: "unpaid",
          };
        },
      },
    },
    webhooks: {
      constructEvent: (payload, header, secret) => {
        if (options?.onConstructEvent) {
          return options.onConstructEvent(String(payload), String(header), secret);
        }
        const expected = createHmac("sha256", secret).update(String(payload)).digest("hex");
        if (String(header) !== expected) {
          const err = new Error("bad sig") as Error & { type: string };
          err.type = "StripeSignatureVerificationError";
          throw err;
        }
        try {
          const parsed = JSON.parse(String(payload)) as {
            id?: string;
            type?: string;
            data?: { object?: Record<string, unknown> };
          };
          return {
            id: parsed.id ?? "evt_1",
            type: parsed.type ?? "checkout.session.completed",
            data: { object: parsed.data?.object ?? { id: "cs_test_1", payment_status: "paid" } },
          };
        } catch {
          return {
            id: "evt_1",
            type: "checkout.session.completed",
            data: { object: { id: "cs_test_1", payment_status: "paid" } },
          };
        }
      },
    },
  });
  return { factory, createCalls };
}

describe("StripePaymentAdapter (TASK-052)", () => {
  it("is resolved through PaymentProviderRegistry", () => {
    const registry = createPaymentProviderRegistry();
    const provider = resolvePaymentProvider(registry, stripeConfig());
    expect(provider).toBeInstanceOf(StripePaymentAdapter);
    expect(provider.methodCode).toBe("STRIPE");
  });

  it("does not resolve/use Stripe when the company method is disabled", async () => {
    const registry = createPaymentProviderRegistry();
    expect(() => resolvePaymentProvider(registry, stripeConfig({ enabled: false }))).toThrow(
      PROVIDER_METHOD_DISABLED,
    );

    const { factory } = createFakeStripeClient();
    const adapter = new StripePaymentAdapter({
      credentialResolver: resolverFor({
        [COMPANY_A]: { secretKey: SECRET_A, enabled: false },
      }),
      createStripeClient: factory,
    });
    await expect(adapter.createPaymentRequest(checkoutInput())).rejects.toThrow(
      PROVIDER_METHOD_DISABLED,
    );
  });

  it("fails closed when credentials are missing", async () => {
    const adapter = new StripePaymentAdapter({
      credentialResolver: {
        async resolveForProvider() {
          throw new Error(PROVIDER_CREDENTIALS_MISSING);
        },
      },
      createStripeClient: createFakeStripeClient().factory,
    });
    await expect(adapter.createPaymentRequest(checkoutInput())).rejects.toThrow(
      PROVIDER_CREDENTIALS_MISSING,
    );
  });

  it("isolates company credentials (Company A secret never used for Company B)", async () => {
    const { factory, createCalls } = createFakeStripeClient();
    const adapter = new StripePaymentAdapter({
      credentialResolver: resolverFor({
        [COMPANY_A]: { secretKey: SECRET_A },
        [COMPANY_B]: { secretKey: SECRET_B },
      }),
      createStripeClient: factory,
    });

    await adapter.createPaymentRequest(checkoutInput({ companyId: COMPANY_A }));
    await adapter.createPaymentRequest(checkoutInput({ companyId: COMPANY_B }));

    expect(createCalls).toHaveLength(2);
    expect((createCalls[0] as { secretKey: string }).secretKey).toBe(SECRET_A);
    expect((createCalls[1] as { secretKey: string }).secretKey).toBe(SECRET_B);
    expect((createCalls[0] as { secretKey: string }).secretKey).not.toBe(SECRET_B);
  });

  it("never returns credentials in provider results", async () => {
    const adapter = new StripePaymentAdapter({
      credentialResolver: resolverFor({ [COMPANY_A]: { secretKey: SECRET_A } }),
      createStripeClient: createFakeStripeClient().factory,
    });
    const result = await adapter.createPaymentRequest(checkoutInput());
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(SECRET_A);
    expect(serialized).not.toContain(WEBHOOK_A);
    expect(serialized).not.toMatch(/sk_test_|whsec_/);
  });

  it("sends the authoritative converted settlement amount and does not recompute FX", async () => {
    const converted = computeConvertedSettlementAmount({
      invoiceAmountApplied: "100.00",
      invoiceCurrencyCode: "GBP",
      settlementCurrencyCode: "USD",
      fixedConversionRate: "1.25",
      settlementDecimalPrecision: 2,
    });
    expect(converted.convertedSettlementAmount.amount).toBe("125");

    const { factory, createCalls } = createFakeStripeClient();
    const adapter = new StripePaymentAdapter({
      credentialResolver: resolverFor({ [COMPANY_A]: { secretKey: SECRET_A } }),
      createStripeClient: factory,
    });

    await adapter.createPaymentRequest(
      checkoutInput({
        invoiceAmountApplied: "100.00",
        convertedSettlementAmount: converted.convertedSettlementAmount.amount,
      }),
    );

    const call = createCalls[0] as {
      params: {
        line_items: Array<{ price_data: { unit_amount: number; currency: string } }>;
        metadata: Record<string, string>;
      };
    };
    expect(call.params.line_items[0]?.price_data.unit_amount).toBe(12500);
    expect(call.params.line_items[0]?.price_data.unit_amount).toBe(
      toProviderAmountInteger(converted.convertedSettlementAmount.amount, 2),
    );
    // Must not charge the invoice-currency amount as if it were USD cents.
    expect(call.params.line_items[0]?.price_data.unit_amount).not.toBe(10000);
    expect(call.params.metadata.convertedSettlementAmount).toBe("125");
    expect(call.params.line_items[0]?.price_data.currency).toBe("usd");
  });

  it("preserves idempotency key across retries of the same logical request", async () => {
    const { factory, createCalls } = createFakeStripeClient();
    const adapter = new StripePaymentAdapter({
      credentialResolver: resolverFor({ [COMPANY_A]: { secretKey: SECRET_A } }),
      createStripeClient: factory,
    });
    const input = checkoutInput();
    const expectedKey = buildStripePaymentRequestIdempotencyKey(input);

    await adapter.createPaymentRequest(input);
    await adapter.createPaymentRequest(input);

    expect(createCalls).toHaveLength(2);
    expect(
      (createCalls[0] as { requestOptions: { idempotencyKey: string } }).requestOptions,
    ).toEqual({ idempotencyKey: expectedKey });
    expect(
      (createCalls[1] as { requestOptions: { idempotencyKey: string } }).requestOptions,
    ).toEqual({ idempotencyKey: expectedKey });
  });

  it("maps Stripe checkout session statuses to provider-neutral statuses", async () => {
    const sessions: Record<string, StripeCheckoutSession> = {
      cs_pending: {
        id: "cs_pending",
        url: null,
        status: "open",
        payment_status: "unpaid",
      },
      cs_paid: {
        id: "cs_paid",
        url: null,
        status: "complete",
        payment_status: "paid",
      },
      cs_failed: {
        id: "cs_failed",
        url: null,
        status: "expired",
        payment_status: "unpaid",
      },
    };
    const adapter = new StripePaymentAdapter({
      credentialResolver: resolverFor({ [COMPANY_A]: { secretKey: SECRET_A } }),
      createStripeClient: createFakeStripeClient({
        onRetrieve: (id) => sessions[id]!,
      }).factory,
    });

    await expect(
      adapter.getPaymentStatus({ companyId: COMPANY_A, externalTransactionId: "cs_pending" }),
    ).resolves.toEqual({ externalTransactionId: "cs_pending", status: "PENDING" });
    await expect(
      adapter.getPaymentStatus({ companyId: COMPANY_A, externalTransactionId: "cs_paid" }),
    ).resolves.toEqual({ externalTransactionId: "cs_paid", status: "SUCCESSFUL" });
    await expect(
      adapter.getPaymentStatus({ companyId: COMPANY_A, externalTransactionId: "cs_failed" }),
    ).resolves.toEqual({ externalTransactionId: "cs_failed", status: "FAILED" });
  });

  it("fails safely on malformed/unexpected provider responses", async () => {
    const adapter = new StripePaymentAdapter({
      credentialResolver: resolverFor({ [COMPANY_A]: { secretKey: SECRET_A } }),
      createStripeClient: createFakeStripeClient({
        onRetrieve: () =>
          ({
            id: "cs_weird",
            url: null,
            status: "complete",
            payment_status: "processing",
          }) as StripeCheckoutSession,
      }).factory,
    });
    await expect(
      adapter.getPaymentStatus({ companyId: COMPANY_A, externalTransactionId: "cs_weird" }),
    ).rejects.toThrow(PROVIDER_INVALID_RESPONSE);
  });

  it("respects sandbox vs live configuration", async () => {
    expect(() => assertStripeSecretMatchesEnvironment("sk_live_x", "SANDBOX")).toThrow(
      PROVIDER_CONFIGURATION_ERROR,
    );
    expect(() => assertStripeSecretMatchesEnvironment("sk_test_x", "LIVE")).toThrow(
      PROVIDER_CONFIGURATION_ERROR,
    );
    expect(() => assertStripeSecretMatchesEnvironment("sk_test_x", "SANDBOX")).not.toThrow();
    expect(() => assertStripeSecretMatchesEnvironment("sk_live_x", "LIVE")).not.toThrow();

    const adapter = new StripePaymentAdapter({
      credentialResolver: resolverFor({
        [COMPANY_A]: { secretKey: "sk_live_wrong_for_sandbox", environment: "SANDBOX" },
      }),
      createStripeClient: createFakeStripeClient().factory,
    });
    await expect(adapter.createPaymentRequest(checkoutInput())).rejects.toThrow(
      PROVIDER_CONFIGURATION_ERROR,
    );
  });

  it("healthCheck reports DISABLED / CONFIGURATION_ERROR / HEALTHY", async () => {
    const adapter = new StripePaymentAdapter({
      credentialResolver: resolverFor({ [COMPANY_A]: { secretKey: SECRET_A } }),
      createStripeClient: createFakeStripeClient().factory,
    });
    await expect(adapter.healthCheck(stripeConfig({ enabled: false }))).resolves.toEqual({
      healthy: false,
      status: "DISABLED",
    });
    await expect(
      adapter.healthCheck(stripeConfig({ credentialsConfigured: false })),
    ).resolves.toEqual({ healthy: false, status: "CONFIGURATION_ERROR" });
    await expect(adapter.healthCheck(stripeConfig({ environment: null }))).resolves.toEqual({
      healthy: false,
      status: "CONFIGURATION_ERROR",
    });
    await expect(adapter.healthCheck(stripeConfig())).resolves.toEqual({
      healthy: true,
      status: "HEALTHY",
    });
  });

  it("verifies webhooks with the company webhook secret and parses Checkout Session events", async () => {
    const payload = JSON.stringify({
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: { id: "cs_test_1", payment_status: "paid", status: "complete" },
      },
    });
    const signature = createHmac("sha256", WEBHOOK_A).update(payload).digest("hex");
    const adapter = new StripePaymentAdapter({
      credentialResolver: resolverFor({
        [COMPANY_A]: { secretKey: SECRET_A, webhookSecret: WEBHOOK_A },
      }),
      createStripeClient: createFakeStripeClient({
        onConstructEvent: (raw, header, secret) => {
          const expected = createHmac("sha256", secret).update(raw).digest("hex");
          if (header !== expected) {
            const err = new Error("bad sig") as Error & { type: string };
            err.type = "StripeSignatureVerificationError";
            throw err;
          }
          return JSON.parse(raw) as {
            id: string;
            type: string;
            data: { object: Record<string, unknown> };
          };
        },
      }).factory,
    });

    await expect(
      adapter.verifyWebhook({
        companyId: COMPANY_A,
        payload,
        headers: { "stripe-signature": signature },
      }),
    ).resolves.toEqual({ verified: true });

    await expect(
      adapter.verifyWebhook({
        companyId: COMPANY_A,
        payload,
        headers: { "stripe-signature": "bad" },
      }),
    ).rejects.toThrow(PROVIDER_WEBHOOK_INVALID);

    await expect(
      adapter.parseWebhook({
        companyId: COMPANY_A,
        payload,
        headers: { "stripe-signature": signature },
      }),
    ).resolves.toEqual({
      externalEventId: "evt_1",
      externalTransactionId: "cs_test_1",
      status: "SUCCESSFUL",
      processorFeeAmount: null,
    });
  });

  it("defers refunds and fee retrieval", async () => {
    const adapter = new StripePaymentAdapter({
      credentialResolver: resolverFor({ [COMPANY_A]: { secretKey: SECRET_A } }),
      createStripeClient: createFakeStripeClient().factory,
    });
    expect(adapter.capabilities.supportsRefunds).toBe(false);
    expect(adapter.capabilities.supportsFeeRetrieval).toBe(false);
    await expect(
      adapter.refundPayment({
        companyId: COMPANY_A,
        externalTransactionId: "cs_1",
        amount: "1.00",
        settlementCurrencyCode: "USD",
        partial: false,
      }),
    ).rejects.toThrow(PROVIDER_CAPABILITY_UNSUPPORTED);
    await expect(
      adapter.getFees({ companyId: COMPANY_A, externalTransactionId: "cs_1" }),
    ).rejects.toThrow(PROVIDER_CAPABILITY_UNSUPPORTED);
  });

  it("does not add Stripe-specific columns to payments and keeps Manual intact", () => {
    const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
    const paymentBlock = schema.slice(
      schema.indexOf("model Payment {"),
      schema.indexOf('@@map("payments")'),
    );
    expect(paymentBlock).not.toMatch(/stripePaymentIntent|stripeCheckoutSession|stripeCustomer/i);
    expect(paymentBlock).not.toMatch(/secretKey|apiKey|webhookSecret/i);

    const registry = createPaymentProviderRegistry();
    expect(registry.require("MANUAL")).toBeInstanceOf(ManualPaymentAdapter);
    expect(registry.require("STRIPE")).toBeInstanceOf(StripePaymentAdapter);
  });

  it("parses Stripe credential keys without exposing them", () => {
    const parsed = parseStripeCredentials({
      apiSecret: SECRET_A,
      apiKey: "pk_test_x",
      webhookSecret: WEBHOOK_A,
    });
    expect(parsed.secretKey).toBe(SECRET_A);
    expect(parsed.publishableKey).toBe("pk_test_x");
    expect(JSON.stringify(parsed)).toContain(SECRET_A); // local object only
    expect(() => parseStripeCredentials({ apiKey: "pk_only" })).toThrow(
      PROVIDER_CREDENTIALS_MISSING,
    );
  });

  it("redacts Stripe secrets from logger paths", () => {
    const loggerSource = readFileSync(resolve(process.cwd(), "src/lib/logger.ts"), "utf8");
    expect(loggerSource).toContain("*.apiSecret");
    expect(loggerSource).toContain("*.webhookSecret");
    expect(loggerSource).toContain("STRIPE_SECRET_KEY");
  });
});

describe("Stripe adapter logging never writes secrets", () => {
  it("error path logs only safe fields", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const adapter = new StripePaymentAdapter({
      credentialResolver: {
        async resolveForProvider() {
          throw new Error(PROVIDER_CREDENTIALS_MISSING);
        },
      },
      createStripeClient: createFakeStripeClient().factory,
    });
    await expect(adapter.createPaymentRequest(checkoutInput())).rejects.toThrow(
      PROVIDER_CREDENTIALS_MISSING,
    );
    const joined = errorSpy.mock.calls.map((call) => JSON.stringify(call)).join("\n");
    expect(joined).not.toContain(SECRET_A);
    expect(joined).not.toContain(WEBHOOK_A);
    errorSpy.mockRestore();
  });
});
