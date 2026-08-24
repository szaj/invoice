import "server-only";

import {
  assertCurrencyPrecision,
  moneyDecimal,
  normalizeCurrencyCode,
  toDecimalString,
  toProviderAmountDecimalString,
} from "@/domain/money";
import { assertPaymentProviderCapability } from "@/domain/payments/providers/capabilities";
import {
  PROVIDER_CAPABILITY_UNSUPPORTED,
  PROVIDER_CONFIGURATION_ERROR,
  PROVIDER_CREDENTIALS_MISSING,
  PROVIDER_EVENT_UNSUPPORTED,
  PROVIDER_INVALID_INPUT,
  PROVIDER_INVALID_RESPONSE,
  PROVIDER_METHOD_DISABLED,
  PROVIDER_REQUEST_REJECTED,
  PROVIDER_TRANSACTION_NOT_FOUND,
  PROVIDER_UNAVAILABLE,
  PROVIDER_WEBHOOK_INVALID,
} from "@/domain/payments/providers/errors";
import type {
  CreatePaymentRequestInput,
  CreatePaymentRequestResult,
  GetFeesInput,
  GetFeesResult,
  GetPaymentStatusInput,
  GetPaymentStatusResult,
  HealthCheckResult,
  ParseWebhookResult,
  PaymentProvider,
  PaymentProviderCapabilities,
  PaymentProviderGatewayConfig,
  ProviderWebhookInput,
  RefundPaymentInput,
  RefundPaymentResult,
  VerifyWebhookResult,
} from "@/domain/payments/providers/types";
import type { PaymentStatus } from "@/domain/payments/types";
import { logger } from "@/lib/logger";
import {
  createGatewayCredentialResolver,
  type GatewayCredentialResolver,
} from "@/server/gateway-credentials/resolve-gateway-credentials";
import {
  createDefaultPayPalClientFactory,
  type PayPalApiClient,
  type PayPalClientFactory,
  type PayPalOrder,
} from "@/server/payments/providers/paypal/paypal-client";
import { parsePayPalCredentials } from "@/server/payments/providers/paypal/paypal-credentials";
import {
  mapPayPalWebhookEvent,
  type PayPalWebhookEvent,
} from "@/server/payments/providers/paypal/paypal-webhook-map";

const PAYPAL_CAPABILITIES: PaymentProviderCapabilities = {
  supportsHostedCheckout: true,
  supportsWebhooks: true,
  supportsRefunds: false,
  supportsPartialRefunds: false,
  supportsFeeRetrieval: false,
  supportsPaymentStatusLookup: true,
  supportsMultipleSettlementCurrencies: true,
  supportsHealthCheck: true,
};

export type PayPalPaymentAdapterDeps = {
  readonly credentialResolver?: GatewayCredentialResolver;
  readonly createPayPalClient?: PayPalClientFactory;
};

/**
 * Stable application-controlled idempotency key for a logical payment request.
 * Same company/invoice/settlement amount/currency/precision/URLs → same key on retry.
 */
export function buildPayPalPaymentRequestIdempotencyKey(input: CreatePaymentRequestInput): string {
  return [
    "paypal",
    "order",
    input.companyId,
    input.invoiceId,
    input.settlementCurrencyCode,
    toDecimalString(input.convertedSettlementAmount),
    String(assertCurrencyPrecision(input.settlementDecimalPrecision)),
    input.successUrl,
    input.cancelUrl,
  ].join(":");
}

function headerValue(headers: ProviderWebhookInput["headers"], name: string): string | null {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (typeof raw === "string") {
    return raw;
  }
  if (Array.isArray(raw) && typeof raw[0] === "string") {
    return raw[0];
  }
  return null;
}

/**
 * Map PayPal order status to application Pending / Successful / Failed.
 * Capture completion remains webhook/hosted-checkout later; APPROVED without COMPLETED stays Pending.
 */
export function mapPayPalOrderStatus(order: Pick<PayPalOrder, "status">): PaymentStatus {
  const status = order.status.toUpperCase();
  if (status === "COMPLETED") {
    return "SUCCESSFUL";
  }
  if (status === "VOIDED" || status === "EXPIRED") {
    return "FAILED";
  }
  if (
    status === "CREATED" ||
    status === "SAVED" ||
    status === "APPROVED" ||
    status === "PAYER_ACTION_REQUIRED"
  ) {
    return "PENDING";
  }
  throw new Error(PROVIDER_INVALID_RESPONSE);
}

function approveLink(order: PayPalOrder): string | null {
  const link = order.links?.find((row) => row.rel === "approve" || row.rel === "payer-action");
  return link?.href ?? null;
}

function isPayPalNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    (error as { statusCode?: number }).statusCode === 404
  );
}

function translatePayPalError(error: unknown): Error {
  if (error instanceof Error) {
    const message = error.message;
    if (
      message === PROVIDER_METHOD_DISABLED ||
      message === PROVIDER_CREDENTIALS_MISSING ||
      message === PROVIDER_CONFIGURATION_ERROR ||
      message === PROVIDER_INVALID_INPUT ||
      message === PROVIDER_INVALID_RESPONSE ||
      message === PROVIDER_EVENT_UNSUPPORTED ||
      message === PROVIDER_WEBHOOK_INVALID ||
      message === PROVIDER_TRANSACTION_NOT_FOUND ||
      message === PROVIDER_CAPABILITY_UNSUPPORTED ||
      message === PROVIDER_UNAVAILABLE ||
      message === PROVIDER_REQUEST_REJECTED
    ) {
      return error;
    }
  }

  if (isPayPalNotFound(error)) {
    return new Error(PROVIDER_TRANSACTION_NOT_FOUND);
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof (error as { statusCode?: number }).statusCode === "number"
  ) {
    const statusCode = (error as { statusCode: number }).statusCode;
    if (statusCode === 401 || statusCode === 403) {
      return new Error(PROVIDER_CONFIGURATION_ERROR);
    }
    if (statusCode === 400 || statusCode === 422) {
      return new Error(PROVIDER_REQUEST_REJECTED);
    }
  }

  return new Error(PROVIDER_UNAVAILABLE);
}

function safeProviderErrorLog(event: string, companyId: string, error: unknown): void {
  const message = error instanceof Error ? error.message : "unknown";
  logger.error(
    {
      event,
      companyId,
      methodCode: "PAYPAL",
      // Never log secrets, Authorization headers, or decrypted credential objects.
      err: message.slice(0, 200),
    },
    "PayPal provider operation failed",
  );
}

/**
 * PayPal PaymentProvider adapter (TASK-054 / TASK-055 / ADR-008).
 * REST calls, credentials, status mapping, and webhook verify/parse stay here.
 * Refunds / fee retrieval / hosted checkout UI remain later tasks.
 */
export class PayPalPaymentAdapter implements PaymentProvider {
  readonly methodCode = "PAYPAL" as const;
  readonly capabilities = PAYPAL_CAPABILITIES;

  private readonly credentialResolverOverride: GatewayCredentialResolver | undefined;
  private readonly createPayPalClient: PayPalClientFactory;
  private lazyCredentialResolver: GatewayCredentialResolver | undefined;

  constructor(deps: PayPalPaymentAdapterDeps = {}) {
    this.credentialResolverOverride = deps.credentialResolver;
    this.createPayPalClient = deps.createPayPalClient ?? createDefaultPayPalClientFactory();
  }

  private get credentialResolver(): GatewayCredentialResolver {
    if (this.credentialResolverOverride) {
      return this.credentialResolverOverride;
    }
    if (!this.lazyCredentialResolver) {
      this.lazyCredentialResolver = createGatewayCredentialResolver();
    }
    return this.lazyCredentialResolver;
  }

  async createPaymentRequest(
    input: CreatePaymentRequestInput,
  ): Promise<CreatePaymentRequestResult> {
    assertPaymentProviderCapability(this, "supportsHostedCheckout");
    try {
      moneyDecimal(input.invoiceAmountApplied);
      moneyDecimal(input.convertedSettlementAmount);
      assertCurrencyPrecision(input.settlementDecimalPrecision);
      normalizeCurrencyCode(input.settlementCurrencyCode);
      if (!input.successUrl.trim() || !input.cancelUrl.trim()) {
        throw new Error(PROVIDER_INVALID_INPUT);
      }

      const client = await this.clientForCompany(input.companyId);
      const value = toProviderAmountDecimalString(
        input.convertedSettlementAmount,
        input.settlementDecimalPrecision,
      );
      const currency = normalizeCurrencyCode(input.settlementCurrencyCode);
      const idempotencyKey = buildPayPalPaymentRequestIdempotencyKey(input);

      // Truncate invoice_id to PayPal's 127-char limit while keeping uniqueness.
      const invoiceRef = input.invoiceId.slice(0, 127);

      const order = await client.orders.create(
        {
          intent: "CAPTURE",
          purchase_units: [
            {
              amount: {
                currency_code: currency,
                // Authoritative Admin converted settlement — never recomputed from PayPal FX.
                value,
              },
              custom_id: input.invoiceId,
              invoice_id: invoiceRef,
              description: `Invoice ${input.invoiceId}`,
            },
          ],
          application_context: {
            return_url: input.successUrl,
            cancel_url: input.cancelUrl,
            user_action: "PAY_NOW",
          },
        },
        { idempotencyKey },
      );

      if (!order.id || typeof order.id !== "string") {
        throw new Error(PROVIDER_INVALID_RESPONSE);
      }

      return {
        externalTransactionId: order.id,
        status: "PENDING",
        checkoutUrl: approveLink(order),
      };
    } catch (error) {
      safeProviderErrorLog("paypal.create_payment_request_failed", input.companyId, error);
      throw translatePayPalError(error);
    }
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusResult> {
    assertPaymentProviderCapability(this, "supportsPaymentStatusLookup");
    try {
      if (!input.externalTransactionId.trim()) {
        throw new Error(PROVIDER_INVALID_INPUT);
      }
      const client = await this.clientForCompany(input.companyId);
      const order = await client.orders.retrieve(input.externalTransactionId);
      if (!order.id) {
        throw new Error(PROVIDER_INVALID_RESPONSE);
      }
      return {
        externalTransactionId: order.id,
        status: mapPayPalOrderStatus(order),
      };
    } catch (error) {
      safeProviderErrorLog("paypal.get_payment_status_failed", input.companyId, error);
      throw translatePayPalError(error);
    }
  }

  async verifyWebhook(input: ProviderWebhookInput): Promise<VerifyWebhookResult> {
    assertPaymentProviderCapability(this, "supportsWebhooks");
    try {
      const resolved = await this.credentialResolver.resolveForProvider({
        companyId: input.companyId,
        methodCode: "PAYPAL",
      });
      const credentials = parsePayPalCredentials(resolved.credentials);
      if (!credentials.webhookId) {
        throw new Error(PROVIDER_CREDENTIALS_MISSING);
      }

      const authAlgo = headerValue(input.headers, "paypal-auth-algo");
      const certUrl = headerValue(input.headers, "paypal-cert-url");
      const transmissionId = headerValue(input.headers, "paypal-transmission-id");
      const transmissionSig = headerValue(input.headers, "paypal-transmission-sig");
      const transmissionTime = headerValue(input.headers, "paypal-transmission-time");
      if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
        throw new Error(PROVIDER_WEBHOOK_INVALID);
      }

      let webhookEvent: unknown;
      try {
        webhookEvent = JSON.parse(input.payload) as unknown;
      } catch {
        throw new Error(PROVIDER_WEBHOOK_INVALID);
      }

      const client = this.createPayPalClient({
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        environment: resolved.environment,
      });
      const verification = await client.webhooks.verifySignature({
        authAlgo,
        certUrl,
        transmissionId,
        transmissionSig,
        transmissionTime,
        webhookId: credentials.webhookId,
        webhookEvent,
      });

      if (verification.verificationStatus !== "SUCCESS") {
        throw new Error(PROVIDER_WEBHOOK_INVALID);
      }
      return { verified: true };
    } catch (error) {
      safeProviderErrorLog("paypal.verify_webhook_failed", input.companyId, error);
      throw translatePayPalError(error);
    }
  }

  async parseWebhook(input: ProviderWebhookInput): Promise<ParseWebhookResult> {
    assertPaymentProviderCapability(this, "supportsWebhooks");
    try {
      await this.verifyWebhook(input);

      let event: unknown;
      try {
        event = JSON.parse(input.payload) as unknown;
      } catch {
        throw new Error(PROVIDER_WEBHOOK_INVALID);
      }
      if (!event || typeof event !== "object") {
        throw new Error(PROVIDER_INVALID_RESPONSE);
      }

      const mapped = mapPayPalWebhookEvent(event as PayPalWebhookEvent);
      return {
        externalEventId: mapped.externalEventId,
        externalTransactionId: mapped.externalTransactionId,
        status: mapped.status,
        processorFeeAmount: mapped.processorFeeAmount,
      };
    } catch (error) {
      safeProviderErrorLog("paypal.parse_webhook_failed", input.companyId, error);
      throw translatePayPalError(error);
    }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    void input;
    assertPaymentProviderCapability(this, "supportsRefunds");
    throw new Error(PROVIDER_CAPABILITY_UNSUPPORTED);
  }

  async getFees(input: GetFeesInput): Promise<GetFeesResult> {
    void input;
    assertPaymentProviderCapability(this, "supportsFeeRetrieval");
    throw new Error(PROVIDER_CAPABILITY_UNSUPPORTED);
  }

  async healthCheck(config: PaymentProviderGatewayConfig): Promise<HealthCheckResult> {
    assertPaymentProviderCapability(this, "supportsHealthCheck");
    if (config.methodCode !== "PAYPAL") {
      return { healthy: false, status: "CONFIGURATION_ERROR" };
    }
    if (!config.enabled) {
      return { healthy: false, status: "DISABLED" };
    }
    if (!config.credentialsConfigured || config.environment == null) {
      return { healthy: false, status: "CONFIGURATION_ERROR" };
    }
    return { healthy: true, status: "HEALTHY" };
  }

  private async clientForCompany(companyId: string): Promise<PayPalApiClient> {
    const resolved = await this.credentialResolver.resolveForProvider({
      companyId,
      methodCode: "PAYPAL",
    });
    const credentials = parsePayPalCredentials(resolved.credentials);
    return this.createPayPalClient({
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      environment: resolved.environment,
    });
  }
}
