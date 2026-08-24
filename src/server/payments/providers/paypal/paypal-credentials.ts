import "server-only";

import type { GatewayEnvironment } from "@/domain/gateway-config/types";
import { PROVIDER_CREDENTIALS_MISSING } from "@/domain/payments/providers/errors";
import type { GatewayCredentialPayload } from "@/server/gateway-credentials/gateway-credential-service";

/**
 * PayPal secrets from the opaque ADR-022 credential map.
 * Form keys (TASK-049): apiKey = client id, apiSecret = client secret,
 * webhookSecret = webhook id (verification; TASK-055 pipeline).
 * Aliases clientId / clientSecret / webhookId are also accepted.
 */
export type PayPalResolvedCredentials = {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly webhookId: string | null;
};

export function parsePayPalCredentials(
  payload: GatewayCredentialPayload,
): PayPalResolvedCredentials {
  const clientId = firstNonEmpty(payload.apiKey, payload.clientId);
  const clientSecret = firstNonEmpty(payload.apiSecret, payload.clientSecret);
  if (!clientId || !clientSecret) {
    throw new Error(PROVIDER_CREDENTIALS_MISSING);
  }
  return {
    clientId,
    clientSecret,
    webhookId: firstNonEmpty(payload.webhookSecret, payload.webhookId),
  };
}

/**
 * PayPal sandbox vs live is selected by API host from company gateway environment.
 * Client IDs do not carry Stripe-style sk_test_/sk_live_ prefixes.
 */
export function paypalApiBaseUrl(environment: GatewayEnvironment): string {
  return environment === "LIVE" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

function firstNonEmpty(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}
