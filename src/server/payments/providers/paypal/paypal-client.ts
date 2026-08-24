import "server-only";

import type { GatewayEnvironment } from "@/domain/gateway-config/types";
import {
  PROVIDER_CONFIGURATION_ERROR,
  PROVIDER_INVALID_RESPONSE,
  PROVIDER_REQUEST_REJECTED,
  PROVIDER_TRANSACTION_NOT_FOUND,
  PROVIDER_UNAVAILABLE,
  PROVIDER_WEBHOOK_INVALID,
} from "@/domain/payments/providers/errors";
import { paypalApiBaseUrl } from "@/server/payments/providers/paypal/paypal-credentials";

/**
 * Narrow PayPal REST surface used by PayPalPaymentAdapter.
 * Keeps HTTP/SDK coupling inside the adapter boundary (ADR-008).
 * Default implementation uses fetch against PayPal REST (Orders v2 + OAuth).
 */

export type PayPalOrderCreateParams = {
  readonly intent: "CAPTURE";
  readonly purchase_units: ReadonlyArray<{
    readonly amount: {
      readonly currency_code: string;
      readonly value: string;
    };
    readonly custom_id?: string;
    readonly invoice_id?: string;
    readonly description?: string;
  }>;
  readonly application_context: {
    readonly return_url: string;
    readonly cancel_url: string;
    readonly user_action?: "PAY_NOW";
  };
};

export type PayPalOrderLink = {
  readonly href: string;
  readonly rel: string;
  readonly method?: string;
};

export type PayPalOrder = {
  readonly id: string;
  readonly status: string;
  readonly links?: readonly PayPalOrderLink[];
};

export type PayPalRequestOptions = {
  readonly idempotencyKey?: string;
};

export type PayPalWebhookVerifyParams = {
  readonly authAlgo: string;
  readonly certUrl: string;
  readonly transmissionId: string;
  readonly transmissionSig: string;
  readonly transmissionTime: string;
  readonly webhookId: string;
  readonly webhookEvent: unknown;
};

export type PayPalApiClient = {
  orders: {
    create(params: PayPalOrderCreateParams, options?: PayPalRequestOptions): Promise<PayPalOrder>;
    retrieve(orderId: string): Promise<PayPalOrder>;
  };
  webhooks: {
    verifySignature(
      params: PayPalWebhookVerifyParams,
    ): Promise<{ readonly verificationStatus: string }>;
  };
};

export type PayPalClientFactory = (input: {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly environment: GatewayEnvironment;
}) => PayPalApiClient;

type TokenCache = {
  accessToken: string;
  expiresAtMs: number;
};

/**
 * Default factory — the only place that talks to PayPal HTTP endpoints.
 * Never uses global PAYPAL_* env for company charges (ADR-022 / company credentials).
 */
export function createDefaultPayPalClientFactory(
  fetchImpl: typeof fetch = fetch,
): PayPalClientFactory {
  return (input): PayPalApiClient => {
    const baseUrl = paypalApiBaseUrl(input.environment);
    let tokenCache: TokenCache | null = null;

    async function getAccessToken(): Promise<string> {
      const now = Date.now();
      if (tokenCache && tokenCache.expiresAtMs > now + 30_000) {
        return tokenCache.accessToken;
      }

      const basic = Buffer.from(`${input.clientId}:${input.clientSecret}`).toString("base64");
      const response = await fetchImpl(`${baseUrl}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: "grant_type=client_credentials",
      });

      if (!response.ok) {
        throw paypalHttpError(response.status, "oauth");
      }

      const body = (await response.json()) as {
        access_token?: string;
        expires_in?: number;
      };
      if (!body.access_token || typeof body.access_token !== "string") {
        throw new Error(PROVIDER_INVALID_RESPONSE);
      }
      const expiresInSec = typeof body.expires_in === "number" ? body.expires_in : 300;
      tokenCache = {
        accessToken: body.access_token,
        expiresAtMs: now + expiresInSec * 1000,
      };
      return body.access_token;
    }

    async function authorizedJson<T>(
      path: string,
      init: {
        method: string;
        body?: string;
        idempotencyKey?: string;
      },
    ): Promise<T> {
      const accessToken = await getAccessToken();
      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      };
      if (init.idempotencyKey) {
        headers["PayPal-Request-Id"] = init.idempotencyKey;
      }

      const response = await fetchImpl(`${baseUrl}${path}`, {
        method: init.method,
        headers,
        body: init.body,
      });

      if (response.status === 404) {
        throw Object.assign(new Error(PROVIDER_TRANSACTION_NOT_FOUND), { statusCode: 404 });
      }
      if (!response.ok) {
        throw paypalHttpError(response.status, path);
      }

      if (response.status === 204) {
        return {} as T;
      }
      return (await response.json()) as T;
    }

    return {
      orders: {
        create: (params, options) =>
          authorizedJson<PayPalOrder>("/v2/checkout/orders", {
            method: "POST",
            body: JSON.stringify(params),
            idempotencyKey: options?.idempotencyKey,
          }),
        retrieve: (orderId) =>
          authorizedJson<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
            method: "GET",
          }),
      },
      webhooks: {
        verifySignature: async (params) => {
          const result = await authorizedJson<{ verification_status?: string }>(
            "/v1/notifications/verify-webhook-signature",
            {
              method: "POST",
              body: JSON.stringify({
                auth_algo: params.authAlgo,
                cert_url: params.certUrl,
                transmission_id: params.transmissionId,
                transmission_sig: params.transmissionSig,
                transmission_time: params.transmissionTime,
                webhook_id: params.webhookId,
                webhook_event: params.webhookEvent,
              }),
            },
          );
          if (!result.verification_status || typeof result.verification_status !== "string") {
            throw new Error(PROVIDER_INVALID_RESPONSE);
          }
          return { verificationStatus: result.verification_status };
        },
      },
    };
  };
}

function paypalHttpError(status: number, context: string): Error {
  if (status === 401 || status === 403) {
    return Object.assign(new Error(PROVIDER_CONFIGURATION_ERROR), { statusCode: status, context });
  }
  if (status === 400 || status === 422) {
    return Object.assign(new Error(PROVIDER_REQUEST_REJECTED), { statusCode: status, context });
  }
  if (status === 404) {
    return Object.assign(new Error(PROVIDER_TRANSACTION_NOT_FOUND), {
      statusCode: status,
      context,
    });
  }
  if (context.includes("verify-webhook") || context.includes("notifications")) {
    return Object.assign(new Error(PROVIDER_WEBHOOK_INVALID), { statusCode: status, context });
  }
  return Object.assign(new Error(PROVIDER_UNAVAILABLE), { statusCode: status, context });
}
