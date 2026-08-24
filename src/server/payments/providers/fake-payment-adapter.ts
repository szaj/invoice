import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { moneyDecimal, toDecimalString } from "@/domain/money";
import { assertPaymentProviderCapability } from "@/domain/payments/providers/capabilities";
import {
  PROVIDER_INVALID_INPUT,
  PROVIDER_TRANSACTION_NOT_FOUND,
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
import type { PaymentMethodCode } from "@/domain/settlement/types";

const FAKE_CAPABILITIES: PaymentProviderCapabilities = {
  supportsHostedCheckout: true,
  supportsWebhooks: true,
  supportsRefunds: true,
  supportsPartialRefunds: true,
  supportsFeeRetrieval: true,
  supportsPaymentStatusLookup: true,
  supportsMultipleSettlementCurrencies: true,
  supportsHealthCheck: true,
};

const FAKE_STATUS_MAP: Readonly<Record<string, PaymentStatus>> = {
  pending: "PENDING",
  succeeded: "SUCCESSFUL",
  successful: "SUCCESSFUL",
  failed: "FAILED",
};

type FakeTransaction = {
  readonly externalTransactionId: string;
  status: PaymentStatus;
  readonly settlementCurrencyCode: string;
  readonly convertedSettlementAmount: string;
  readonly processorFeeAmount: string | null;
};

export type FakePaymentAdapterOptions = {
  readonly methodCode: PaymentMethodCode;
  /** Test-only signing secret. Never copied onto payment records or results. */
  readonly webhookSecret: string;
  readonly defaultProcessorFeeAmount?: string | null;
};

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

function mapFakeStatus(raw: string): PaymentStatus {
  const mapped = FAKE_STATUS_MAP[raw.trim().toLowerCase()];
  if (!mapped) {
    throw new Error(PROVIDER_INVALID_INPUT);
  }
  return mapped;
}

function signPayload(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function signaturesMatch(expected: string, provided: string): boolean {
  const expectedBytes = Buffer.from(expected, "utf8");
  const providedBytes = Buffer.from(provided, "utf8");
  if (expectedBytes.length !== providedBytes.length) {
    return false;
  }
  return timingSafeEqual(expectedBytes, providedBytes);
}

/**
 * In-memory provider for contract tests. Not Stripe/PayPal/bank; no live charges.
 */
export class FakePaymentAdapter implements PaymentProvider {
  readonly methodCode: PaymentMethodCode;
  readonly capabilities = FAKE_CAPABILITIES;
  private readonly webhookSecret: string;
  private readonly defaultProcessorFeeAmount: string | null;
  private readonly transactions = new Map<string, FakeTransaction>();
  private nextId = 1;

  constructor(options: FakePaymentAdapterOptions) {
    this.methodCode = options.methodCode;
    this.webhookSecret = options.webhookSecret;
    this.defaultProcessorFeeAmount =
      options.defaultProcessorFeeAmount != null
        ? toDecimalString(options.defaultProcessorFeeAmount)
        : null;
  }

  async createPaymentRequest(
    input: CreatePaymentRequestInput,
  ): Promise<CreatePaymentRequestResult> {
    assertPaymentProviderCapability(this, "supportsHostedCheckout");
    moneyDecimal(input.invoiceAmountApplied);
    moneyDecimal(input.convertedSettlementAmount);
    const externalTransactionId = `fake_${String(this.nextId).padStart(6, "0")}`;
    this.nextId += 1;
    this.transactions.set(externalTransactionId, {
      externalTransactionId,
      status: "PENDING",
      settlementCurrencyCode: input.settlementCurrencyCode,
      convertedSettlementAmount: toDecimalString(input.convertedSettlementAmount),
      processorFeeAmount: this.defaultProcessorFeeAmount,
    });
    return {
      externalTransactionId,
      status: "PENDING",
      checkoutUrl: `https://payments.test/checkout/${externalTransactionId}`,
    };
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusResult> {
    assertPaymentProviderCapability(this, "supportsPaymentStatusLookup");
    const transaction = this.transactions.get(input.externalTransactionId);
    if (!transaction) {
      throw new Error(PROVIDER_TRANSACTION_NOT_FOUND);
    }
    return {
      externalTransactionId: transaction.externalTransactionId,
      status: transaction.status,
    };
  }

  async verifyWebhook(input: ProviderWebhookInput): Promise<VerifyWebhookResult> {
    assertPaymentProviderCapability(this, "supportsWebhooks");
    void input.companyId;
    const provided = headerValue(input.headers, "x-webhook-signature");
    if (!provided) {
      throw new Error(PROVIDER_WEBHOOK_INVALID);
    }
    const expected = signPayload(this.webhookSecret, input.payload);
    if (!signaturesMatch(expected, provided)) {
      throw new Error(PROVIDER_WEBHOOK_INVALID);
    }
    return { verified: true };
  }

  async parseWebhook(input: ProviderWebhookInput): Promise<ParseWebhookResult> {
    assertPaymentProviderCapability(this, "supportsWebhooks");
    await this.verifyWebhook(input);
    let parsed: {
      externalEventId?: unknown;
      externalTransactionId?: unknown;
      status?: unknown;
      processorFeeAmount?: unknown;
    };
    try {
      parsed = JSON.parse(input.payload) as typeof parsed;
    } catch {
      throw new Error(PROVIDER_INVALID_INPUT);
    }
    if (
      typeof parsed.externalEventId !== "string" ||
      typeof parsed.externalTransactionId !== "string" ||
      typeof parsed.status !== "string"
    ) {
      throw new Error(PROVIDER_INVALID_INPUT);
    }
    const status = mapFakeStatus(parsed.status);
    const transaction = this.transactions.get(parsed.externalTransactionId);
    if (transaction) {
      transaction.status = status;
    }
    let processorFeeAmount: string | null = transaction?.processorFeeAmount ?? null;
    if (parsed.processorFeeAmount != null) {
      if (typeof parsed.processorFeeAmount !== "string") {
        throw new Error(PROVIDER_INVALID_INPUT);
      }
      processorFeeAmount = toDecimalString(parsed.processorFeeAmount);
    }
    return {
      externalEventId: parsed.externalEventId,
      externalTransactionId: parsed.externalTransactionId,
      status,
      processorFeeAmount,
    };
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    if (input.partial) {
      assertPaymentProviderCapability(this, "supportsPartialRefunds");
    } else {
      assertPaymentProviderCapability(this, "supportsRefunds");
    }
    const transaction = this.transactions.get(input.externalTransactionId);
    if (!transaction) {
      throw new Error(PROVIDER_TRANSACTION_NOT_FOUND);
    }
    const amount = toDecimalString(moneyDecimal(input.amount));
    return {
      externalRefundId: `fake_rf_${transaction.externalTransactionId}`,
      amount,
      settlementCurrencyCode: input.settlementCurrencyCode,
    };
  }

  async getFees(input: GetFeesInput): Promise<GetFeesResult> {
    assertPaymentProviderCapability(this, "supportsFeeRetrieval");
    const transaction = this.transactions.get(input.externalTransactionId);
    if (!transaction) {
      throw new Error(PROVIDER_TRANSACTION_NOT_FOUND);
    }
    return {
      processorFeeAmount: transaction.processorFeeAmount,
      settlementCurrencyCode: transaction.settlementCurrencyCode,
    };
  }

  async healthCheck(config: PaymentProviderGatewayConfig): Promise<HealthCheckResult> {
    assertPaymentProviderCapability(this, "supportsHealthCheck");
    if (!config.enabled) {
      return { healthy: false, status: "DISABLED" };
    }
    return { healthy: true, status: "HEALTHY" };
  }

  /** Test helper — never part of the PaymentProvider contract. */
  signWebhookPayload(payload: string): string {
    return signPayload(this.webhookSecret, payload);
  }
}
