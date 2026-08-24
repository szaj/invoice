import "server-only";

import type { GatewayEnvironment } from "@/domain/gateway-config/types";
import {
  PROVIDER_CONFIGURATION_ERROR,
  PROVIDER_CREDENTIALS_MISSING,
  PROVIDER_METHOD_DISABLED,
} from "@/domain/payments/providers/errors";
import type { PaymentMethodCode } from "@/domain/settlement/types";
import {
  PrismaGatewayConfigStore,
  type GatewayConfigRow,
} from "@/server/gateway-config/gateway-config-repository";
import {
  GatewayCredentialCryptoError,
  GatewayCredentialService,
  getGatewayCredentialService,
  type GatewayCredentialPayload,
} from "@/server/gateway-credentials/gateway-credential-service";

export type ResolvedGatewayCredentials = {
  readonly companyId: string;
  readonly methodCode: PaymentMethodCode;
  readonly enabled: boolean;
  readonly environment: GatewayEnvironment;
  readonly credentialsConfigured: true;
  readonly enabledSettlementCurrencyCodes: readonly string[];
  readonly credentials: GatewayCredentialPayload;
};

export type GatewayCredentialResolver = {
  resolveForProvider(input: {
    readonly companyId: string;
    readonly methodCode: PaymentMethodCode;
  }): Promise<ResolvedGatewayCredentials>;
};

export type GatewayCredentialResolverDeps = {
  readonly store?: Pick<PrismaGatewayConfigStore, "getMethodRow">;
  readonly credentialService?: GatewayCredentialService;
};

/**
 * Controlled server-only credential resolution for PaymentProvider adapters (ADR-022).
 * Routes, RSC, audit, and serializers must not call this.
 */
export function createGatewayCredentialResolver(
  deps: GatewayCredentialResolverDeps = {},
): GatewayCredentialResolver {
  const store = deps.store ?? new PrismaGatewayConfigStore();

  return {
    async resolveForProvider(input) {
      const credentialService = deps.credentialService ?? getGatewayCredentialService();
      const row = await store.getMethodRow(input.companyId, input.methodCode);
      return decryptRowOrThrow(row, input.companyId, input.methodCode, credentialService);
    },
  };
}

function decryptRowOrThrow(
  row: GatewayConfigRow | null,
  companyId: string,
  methodCode: PaymentMethodCode,
  credentialService: GatewayCredentialService,
): ResolvedGatewayCredentials {
  if (!row || !row.enabled) {
    throw new Error(PROVIDER_METHOD_DISABLED);
  }
  if (!row.credentialsConfigured || !row.envelope) {
    throw new Error(PROVIDER_CREDENTIALS_MISSING);
  }
  if (row.environment == null) {
    throw new Error(PROVIDER_CONFIGURATION_ERROR);
  }

  let credentials: GatewayCredentialPayload;
  try {
    credentials = credentialService.decryptCredentials(row.envelope, {
      companyId,
      methodCode,
    });
  } catch (error) {
    if (error instanceof GatewayCredentialCryptoError) {
      throw new Error(PROVIDER_CONFIGURATION_ERROR);
    }
    throw error;
  }

  return {
    companyId,
    methodCode,
    enabled: true,
    environment: row.environment,
    credentialsConfigured: true,
    enabledSettlementCurrencyCodes: row.enabledSettlementCurrencyCodes,
    credentials,
  };
}
