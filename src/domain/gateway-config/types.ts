import type { PaymentMethodCode } from "@/domain/settlement/types";

export const GATEWAY_ENVIRONMENTS = ["SANDBOX", "LIVE"] as const;
export type GatewayEnvironment = (typeof GATEWAY_ENVIRONMENTS)[number];

/** Operational status indicator (Payments §10.2). Derived — never decrypts. */
export const GATEWAY_CONFIG_STATUSES = ["HEALTHY", "CONFIGURATION_ERROR", "DISABLED"] as const;
export type GatewayConfigStatus = (typeof GATEWAY_CONFIG_STATUSES)[number];

/**
 * Methods that require encrypted credentials when enabled for live gateway use.
 * MANUAL does not require stored credentials.
 */
export const GATEWAY_METHODS_REQUIRING_CREDENTIALS = [
  "STRIPE",
  "PAYPAL",
  "BANK_PROCESSOR",
] as const satisfies readonly PaymentMethodCode[];

export function methodRequiresCredentials(methodCode: PaymentMethodCode): boolean {
  return (GATEWAY_METHODS_REQUIRING_CREDENTIALS as readonly string[]).includes(methodCode);
}

/**
 * Safe client/API view of company gateway configuration.
 * Never includes plaintext, ciphertext, DEKs, nonces, tags, or keys.
 */
export type GatewayMethodSafeView = {
  readonly methodCode: PaymentMethodCode;
  readonly methodEnabled: boolean;
  readonly environment: GatewayEnvironment | null;
  readonly credentialsConfigured: boolean;
  /** Non-secret provider-specific config only. */
  readonly providerConfig: Readonly<Record<string, unknown>> | null;
  readonly enabledSettlementCurrencyCodes: readonly string[];
  readonly status: GatewayConfigStatus;
  /** True when the PaymentProvider registry has an adapter for this method. */
  readonly providerRegistered: boolean;
};

export type CompanyGatewayConfiguration = {
  readonly companyId: string;
  readonly companyDisplayName: string;
  readonly methods: readonly GatewayMethodSafeView[];
};

export function deriveGatewayConfigStatus(input: {
  readonly methodEnabled: boolean;
  readonly methodCode: PaymentMethodCode;
  readonly credentialsConfigured: boolean;
  readonly environment: GatewayEnvironment | null;
}): GatewayConfigStatus {
  if (!input.methodEnabled) {
    return "DISABLED";
  }
  if (methodRequiresCredentials(input.methodCode)) {
    if (!input.credentialsConfigured || input.environment === null) {
      return "CONFIGURATION_ERROR";
    }
  }
  return "HEALTHY";
}

export const GATEWAY_INVALID_INPUT = "Check the gateway configuration and try again.";
export const GATEWAY_METHOD_NOT_FOUND = "Payment method configuration was not found.";
export const GATEWAY_UNAVAILABLE = "Gateway configuration is temporarily unavailable.";
export const GATEWAY_CREDENTIALS_REQUIRED =
  "Encrypted credentials are required for this payment method.";
export const GATEWAY_ENCRYPTION_UNAVAILABLE =
  "Gateway credential encryption is not available. Check server key configuration.";
