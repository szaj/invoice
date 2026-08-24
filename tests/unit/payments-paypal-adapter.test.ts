import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { computeConvertedSettlementAmount, toProviderAmountDecimalString } from "@/domain/money";
import {
  PROVIDER_CAPABILITY_UNSUPPORTED,
  PROVIDER_CREDENTIALS_MISSING,
  PROVIDER_EVENT_UNSUPPORTED,
  PROVIDER_INVALID_RESPONSE,
  PROVIDER_METHOD_DISABLED,
  PROVIDER_WEBHOOK_INVALID,
} from "@/domain/payments/providers/errors";
import { resolvePaymentProvider } from "@/domain/payments/providers/registry";
import type { PaymentProviderGatewayConfig } from "@/domain/payments/providers/types";
import { createPaymentProviderRegistry } from "@/server/payments/providers/create-payment-provider-registry";
import { ManualPaymentAdapter } from "@/server/payments/providers/manual-payment-adapter";
import type {
  PayPalApiClient,
  PayPalOrder,
} from "@/server/payments/providers/paypal/paypal-client";
import {
  parsePayPalCredentials,
  paypalApiBaseUrl,
} from "@/server/payments/providers/paypal/paypal-credentials";
import {
  buildPayPalPaymentRequestIdempotencyKey,
  mapPayPalOrderStatus,
  PayPalPaymentAdapter,
} from "@/server/payments/providers/paypal/paypal-payment-adapter";
import type { GatewayCredentialResolver } from "@/server/gateway-credentials/resolve-gateway-credentials";

const COMPANY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COMPANY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const INVOICE_ID = "22222222-2222-4222-8222-222222222222";
const CUSTOMER_ID = "33333333-3333-4333-8333-333333333333";
const CLIENT_A = "paypal_client_a";
const CLIENT_B = "paypal_client_b";
const SECRET_A = "paypal_secret_a_value";
const SECRET_B = "paypal_secret_b_value";
const WEBHOOK_A = "WH-aaaaaaaa";

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

function paypalConfig(
  overrides: Partial<PaymentProviderGatewayConfig> = {},
): PaymentProviderGatewayConfig {
  return {
    companyId: COMPANY_A,
    methodCode: "PAYPAL",
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
      clientId: string;
      clientSecret: string;
      webhookId?: string;
      environment?: "SANDBOX" | "LIVE";
      enabled?: boolean;
    }
  >,
): GatewayCredentialResolver {
  return {
    async resolveForProvider({ companyId, methodCode }) {
      if (methodCode !== "PAYPAL") {
        throw new Error(PROVIDER_METHOD_DISABLED);
      }
      const entry = map[companyId];
      if (!entry || entry.enabled === false) {
        throw new Error(PROVIDER_METHOD_DISABLED);
      }
      return {
        companyId,
        methodCode: "PAYPAL",
        enabled: true,
        environment: entry.environment ?? "SANDBOX",
        credentialsConfigured: true as const,
        enabledSettlementCurrencyCodes: ["USD"],
        credentials: {
          apiKey: entry.clientId,
          apiSecret: entry.clientSecret,
          webhookSecret: entry.webhookId ?? WEBHOOK_A,
        },
      };
    },
  };
}

function fakeClientFactory(options?: {
  onCreate?: (params: {
    clientId: string;
    environment: string;
    value: string;
    currency: string;
    idempotencyKey?: string;
  }) => void;
  orderStatus?: string;
  missingApprove?: boolean;
}): (input: {
  clientId: string;
  clientSecret: string;
  environment: "SANDBOX" | "LIVE";
}) => PayPalApiClient {
  return (input) => ({
    orders: {
      create: async (params, requestOptions) => {
        const unit = params.purchase_units[0]!;
        options?.onCreate?.({
          clientId: input.clientId,
          environment: input.environment,
          value: unit.amount.value,
          currency: unit.amount.currency_code,
          idempotencyKey: requestOptions?.idempotencyKey,
        });
        const order: PayPalOrder = {
          id: `ORDER-${input.clientId}`,
          status: "CREATED",
          links: options?.missingApprove
            ? []
            : [
                {
                  href: `https://www.sandbox.paypal.com/checkoutnow?token=ORDER-${input.clientId}`,
                  rel: "approve",
                  method: "GET",
                },
              ],
        };
        return order;
      },
      retrieve: async (id) => ({
        id,
        status: options?.orderStatus ?? "CREATED",
        links: [],
      }),
    },
    webhooks: {
      verifySignature: async ({ webhookId, transmissionSig }) => {
        if (transmissionSig === "bad") {
          return { verificationStatus: "FAILURE" };
        }
        if (webhookId !== WEBHOOK_A) {
          return { verificationStatus: "FAILURE" };
        }
        return { verificationStatus: "SUCCESS" };
      },
    },
  });
}

describe("PayPal adapter (TASK-054)", () => {
  it("registers in the default PaymentProvider registry", () => {
    const registry = createPaymentProviderRegistry();
    expect(registry.require("PAYPAL")).toBeInstanceOf(PayPalPaymentAdapter);
    expect(resolvePaymentProvider(registry, paypalConfig()).methodCode).toBe("PAYPAL");
    expect(registry.require("MANUAL")).toBeInstanceOf(ManualPaymentAdapter);
  });

  it("parses company credentials and selects sandbox/live API hosts", () => {
    expect(
      parsePayPalCredentials({
        apiKey: CLIENT_A,
        apiSecret: SECRET_A,
        webhookSecret: WEBHOOK_A,
      }),
    ).toEqual({
      clientId: CLIENT_A,
      clientSecret: SECRET_A,
      webhookId: WEBHOOK_A,
    });
    expect(() => parsePayPalCredentials({ apiKey: CLIENT_A })).toThrow(
      PROVIDER_CREDENTIALS_MISSING,
    );
    expect(paypalApiBaseUrl("SANDBOX")).toBe("https://api-m.sandbox.paypal.com");
    expect(paypalApiBaseUrl("LIVE")).toBe("https://api-m.paypal.com");
  });

  it("fails closed when method disabled or credentials missing", async () => {
    const disabled = new PayPalPaymentAdapter({
      credentialResolver: resolverFor({
        [COMPANY_A]: { clientId: CLIENT_A, clientSecret: SECRET_A, enabled: false },
      }),
      createPayPalClient: fakeClientFactory(),
    });
    await expect(disabled.createPaymentRequest(checkoutInput())).rejects.toThrow(
      PROVIDER_METHOD_DISABLED,
    );

    const missing = new PayPalPaymentAdapter({
      credentialResolver: {
        async resolveForProvider() {
          throw new Error(PROVIDER_CREDENTIALS_MISSING);
        },
      },
      createPayPalClient: fakeClientFactory(),
    });
    await expect(missing.createPaymentRequest(checkoutInput())).rejects.toThrow(
      PROVIDER_CREDENTIALS_MISSING,
    );
  });

  it("isolates company credentials and never returns secrets", async () => {
    const createCalls: Array<{ clientId: string; value: string }> = [];
    const adapter = new PayPalPaymentAdapter({
      credentialResolver: resolverFor({
        [COMPANY_A]: { clientId: CLIENT_A, clientSecret: SECRET_A },
        [COMPANY_B]: { clientId: CLIENT_B, clientSecret: SECRET_B },
      }),
      createPayPalClient: fakeClientFactory({
        onCreate: (params) => createCalls.push({ clientId: params.clientId, value: params.value }),
      }),
    });

    const a = await adapter.createPaymentRequest(checkoutInput({ companyId: COMPANY_A }));
    const b = await adapter.createPaymentRequest(checkoutInput({ companyId: COMPANY_B }));
    expect(createCalls[0]?.clientId).toBe(CLIENT_A);
    expect(createCalls[1]?.clientId).toBe(CLIENT_B);
    expect(JSON.stringify(a)).not.toContain(SECRET_A);
    expect(JSON.stringify(b)).not.toContain(SECRET_B);
    expect(a.checkoutUrl).toContain("sandbox.paypal.com");
  });

  it("uses Admin converted settlement Decimal string — never PayPal FX or invoice amount", async () => {
    const converted = computeConvertedSettlementAmount({
      invoiceAmountApplied: "100.00",
      invoiceCurrencyCode: "GBP",
      settlementCurrencyCode: "USD",
      fixedConversionRate: "1.25",
      settlementDecimalPrecision: 2,
    });
    expect(converted.convertedSettlementAmount.amount).toBe("125");

    let seenValue: string | null = null;
    let seenCurrency: string | null = null;
    const adapter = new PayPalPaymentAdapter({
      credentialResolver: resolverFor({
        [COMPANY_A]: { clientId: CLIENT_A, clientSecret: SECRET_A },
      }),
      createPayPalClient: fakeClientFactory({
        onCreate: (params) => {
          seenValue = params.value;
          seenCurrency = params.currency;
        },
      }),
    });

    await adapter.createPaymentRequest(
      checkoutInput({
        convertedSettlementAmount: converted.convertedSettlementAmount.amount,
      }),
    );

    expect(seenValue).toBe(toProviderAmountDecimalString("125", 2));
    expect(seenValue).toBe("125.00");
    expect(seenValue).not.toBe("100.00");
    expect(seenCurrency).toBe("USD");
  });

  it("keeps idempotency key stable across retries", () => {
    const input = checkoutInput();
    expect(buildPayPalPaymentRequestIdempotencyKey(input)).toBe(
      buildPayPalPaymentRequestIdempotencyKey(input),
    );
    expect(buildPayPalPaymentRequestIdempotencyKey(input)).not.toBe(
      buildPayPalPaymentRequestIdempotencyKey(checkoutInput({ cancelUrl: "https://other/cancel" })),
    );
  });

  it("maps PayPal order statuses to Pending/Successful/Failed", () => {
    expect(mapPayPalOrderStatus({ status: "CREATED" })).toBe("PENDING");
    expect(mapPayPalOrderStatus({ status: "APPROVED" })).toBe("PENDING");
    expect(mapPayPalOrderStatus({ status: "COMPLETED" })).toBe("SUCCESSFUL");
    expect(mapPayPalOrderStatus({ status: "VOIDED" })).toBe("FAILED");
    expect(() => mapPayPalOrderStatus({ status: "WEIRD" })).toThrow(PROVIDER_INVALID_RESPONSE);
  });

  it("getPaymentStatus returns normalized application status", async () => {
    const adapter = new PayPalPaymentAdapter({
      credentialResolver: resolverFor({
        [COMPANY_A]: { clientId: CLIENT_A, clientSecret: SECRET_A },
      }),
      createPayPalClient: fakeClientFactory({ orderStatus: "COMPLETED" }),
    });
    const status = await adapter.getPaymentStatus({
      companyId: COMPANY_A,
      externalTransactionId: "ORDER-1",
    });
    expect(status).toEqual({ externalTransactionId: "ORDER-1", status: "SUCCESSFUL" });
  });

  it("verifyWebhook rejects unsigned/invalid signatures; parseWebhook maps capture completed", async () => {
    const adapter = new PayPalPaymentAdapter({
      credentialResolver: resolverFor({
        [COMPANY_A]: { clientId: CLIENT_A, clientSecret: SECRET_A, webhookId: WEBHOOK_A },
      }),
      createPayPalClient: fakeClientFactory(),
    });

    await expect(
      adapter.verifyWebhook({ companyId: COMPANY_A, payload: "{}", headers: {} }),
    ).rejects.toThrow(PROVIDER_WEBHOOK_INVALID);

    await expect(
      adapter.verifyWebhook({
        companyId: COMPANY_A,
        payload: "{}",
        headers: {
          "paypal-auth-algo": "SHA256withRSA",
          "paypal-cert-url": "https://api.paypal.com/cert",
          "paypal-transmission-id": "tx-1",
          "paypal-transmission-sig": "bad",
          "paypal-transmission-time": "2026-08-24T00:00:00Z",
        },
      }),
    ).rejects.toThrow(PROVIDER_WEBHOOK_INVALID);

    const verifiedHeaders = {
      "paypal-auth-algo": "SHA256withRSA",
      "paypal-cert-url": "https://api.paypal.com/cert",
      "paypal-transmission-id": "tx-1",
      "paypal-transmission-sig": "good",
      "paypal-transmission-time": "2026-08-24T00:00:00Z",
    };

    await expect(
      adapter.verifyWebhook({
        companyId: COMPANY_A,
        payload: "{}",
        headers: verifiedHeaders,
      }),
    ).resolves.toEqual({ verified: true });

    const capturePayload = JSON.stringify({
      id: "WH-EVT-1",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: {
        id: "CAPTURE-1",
        supplementary_data: { related_ids: { order_id: "ORDER-1" } },
      },
    });
    const parsed = await adapter.parseWebhook({
      companyId: COMPANY_A,
      payload: capturePayload,
      headers: verifiedHeaders,
    });
    expect(parsed).toEqual({
      externalEventId: "WH-EVT-1",
      externalTransactionId: "ORDER-1",
      status: "SUCCESSFUL",
      processorFeeAmount: null,
    });

    await expect(
      adapter.parseWebhook({
        companyId: COMPANY_A,
        payload: JSON.stringify({
          id: "WH-X",
          event_type: "BILLING.SUBSCRIPTION.CREATED",
          resource: {},
        }),
        headers: verifiedHeaders,
      }),
    ).rejects.toThrow(PROVIDER_EVENT_UNSUPPORTED);
  });

  it("defers refunds and fee retrieval; healthCheck reflects config", async () => {
    const adapter = new PayPalPaymentAdapter({
      credentialResolver: resolverFor({
        [COMPANY_A]: { clientId: CLIENT_A, clientSecret: SECRET_A },
      }),
      createPayPalClient: fakeClientFactory(),
    });
    await expect(
      adapter.refundPayment({
        companyId: COMPANY_A,
        externalTransactionId: "ORDER-1",
        amount: "1.00",
        settlementCurrencyCode: "USD",
        partial: false,
      }),
    ).rejects.toThrow(PROVIDER_CAPABILITY_UNSUPPORTED);
    await expect(
      adapter.getFees({ companyId: COMPANY_A, externalTransactionId: "ORDER-1" }),
    ).rejects.toThrow(PROVIDER_CAPABILITY_UNSUPPORTED);

    expect(await adapter.healthCheck(paypalConfig())).toEqual({
      healthy: true,
      status: "HEALTHY",
    });
    expect(await adapter.healthCheck(paypalConfig({ enabled: false }))).toEqual({
      healthy: false,
      status: "DISABLED",
    });
    expect(await adapter.healthCheck(paypalConfig({ credentialsConfigured: false }))).toEqual({
      healthy: false,
      status: "CONFIGURATION_ERROR",
    });
  });

  it("keeps PayPal HTTP client inside the adapter boundary (no npm PayPal SDK)", () => {
    const paymentService = readFileSync(
      resolve(process.cwd(), "src/server/payments/payment-service.ts"),
      "utf8",
    );
    expect(paymentService).not.toMatch(/paypal|PayPal/i);
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    expect(Object.keys(pkg.dependencies ?? {}).some((name) => /paypal/i.test(name))).toBe(false);
  });
});
