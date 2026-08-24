import "server-only";

import type { GatewayEnvironment } from "@/domain/gateway-config/types";
import {
  PROVIDER_CONFIGURATION_ERROR,
  PROVIDER_CREDENTIALS_MISSING,
} from "@/domain/payments/providers/errors";
import type { GatewayCredentialPayload } from "@/server/gateway-credentials/gateway-credential-service";

/**
 * Stripe secrets from the opaque ADR-022 credential map.
 * Form keys (TASK-049): apiSecret = secret key, apiKey = publishable, webhookSecret = signing secret.
 * Aliases secretKey / publishableKey are also accepted.
 */
export type StripeResolvedCredentials = {
  readonly secretKey: string;
  readonly publishableKey: string | null;
  readonly webhookSecret: string | null;
};

export function parseStripeCredentials(
  payload: GatewayCredentialPayload,
): StripeResolvedCredentials {
  const secretKey = firstNonEmpty(payload.apiSecret, payload.secretKey);
  if (!secretKey) {
    throw new Error(PROVIDER_CREDENTIALS_MISSING);
  }
  return {
    secretKey,
    publishableKey: firstNonEmpty(payload.apiKey, payload.publishableKey),
    webhookSecret: firstNonEmpty(payload.webhookSecret),
  };
}

/**
 * Fail closed when sandbox/live environment does not match the secret key prefix.
 * Does not invent credentials or fall back across companies.
 */
export function assertStripeSecretMatchesEnvironment(
  secretKey: string,
  environment: GatewayEnvironment,
): void {
  if (environment === "SANDBOX" && !secretKey.startsWith("sk_test_")) {
    throw new Error(PROVIDER_CONFIGURATION_ERROR);
  }
  if (environment === "LIVE" && !secretKey.startsWith("sk_live_")) {
    throw new Error(PROVIDER_CONFIGURATION_ERROR);
  }
}

function firstNonEmpty(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}
