import "server-only";

import { logger } from "@/lib/logger";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import { AuditActions, AuditEntityTypes, type AuditJson } from "@/domain/audit/types";
import { companyIdSchema } from "@/domain/companies/company-schema";
import { COMPANY_NOT_FOUND_MESSAGE } from "@/domain/companies/types";
import {
  gatewayCredentialsReplaceSchema,
  gatewayMethodConfigWriteSchema,
  paymentMethodCodeSchema,
} from "@/domain/gateway-config/schema";
import {
  GATEWAY_ENCRYPTION_UNAVAILABLE,
  GATEWAY_INVALID_INPUT,
  GATEWAY_METHOD_NOT_FOUND,
  GATEWAY_UNAVAILABLE,
  type CompanyGatewayConfiguration,
  type GatewayMethodSafeView,
} from "@/domain/gateway-config/types";
import type { PaymentProviderGatewayConfig } from "@/domain/payments/providers/types";
import type { PaymentMethodCode } from "@/domain/settlement/types";
import {
  getAuditWriter,
  recordAuditEventRequired,
  type AuditWriter,
} from "@/server/audit/audit-service";
import { PrismaGatewayConfigStore } from "@/server/gateway-config/gateway-config-repository";
import {
  GatewayCredentialCryptoError,
  GatewayCredentialService,
  getGatewayCredentialService,
} from "@/server/gateway-credentials/gateway-credential-service";

export type GatewayConfigResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 403 | 404 | 503; error: string };

export interface GatewayConfigDependencies {
  readonly store: Pick<
    PrismaGatewayConfigStore,
    | "companyExists"
    | "getCompanyGatewayConfiguration"
    | "getMethodRow"
    | "updateNonSecretConfig"
    | "replaceCredentials"
  >;
  readonly credentialService?: GatewayCredentialService;
  readonly auditWriter?: AuditWriter;
}

export function createDefaultGatewayConfigDependencies(): GatewayConfigDependencies {
  return {
    store: new PrismaGatewayConfigStore(),
  };
}

function auditWriterOf(deps: GatewayConfigDependencies): AuditWriter {
  return deps.auditWriter ?? getAuditWriter();
}

function credentialServiceOf(deps: GatewayConfigDependencies): GatewayCredentialService {
  return deps.credentialService ?? getGatewayCredentialService();
}

function requireGatewayManage(actor: AuthorizationPrincipal | null) {
  assertPermission(actor, "gateway.credentials.manage");
}

function safeMethodSummary(
  method: GatewayMethodSafeView | undefined,
  methodCode: string,
): AuditJson {
  if (!method) {
    return { methodCode, methodEnabled: false, credentialsConfigured: false };
  }
  return {
    methodCode: method.methodCode,
    methodEnabled: method.methodEnabled,
    environment: method.environment,
    credentialsConfigured: method.credentialsConfigured,
    status: method.status,
    providerConfigKeys:
      method.providerConfig == null ? [] : Object.keys(method.providerConfig).sort(),
    enabledSettlementCurrencyCodes: [...method.enabledSettlementCurrencyCodes],
  };
}

/**
 * Safe JSON for API/client. Strips any accidental envelope fields.
 */
export function toPublicGatewayConfiguration(
  configuration: CompanyGatewayConfiguration,
): CompanyGatewayConfiguration {
  return {
    companyId: configuration.companyId,
    companyDisplayName: configuration.companyDisplayName,
    methods: configuration.methods.map((method) => ({
      methodCode: method.methodCode,
      methodEnabled: method.methodEnabled,
      environment: method.environment,
      credentialsConfigured: method.credentialsConfigured,
      providerConfig: method.providerConfig,
      enabledSettlementCurrencyCodes: method.enabledSettlementCurrencyCodes,
      status: method.status,
      providerRegistered: method.providerRegistered,
    })),
  };
}

export async function getCompanyGatewayConfiguration(
  actor: AuthorizationPrincipal | null,
  companyId: string,
  deps: GatewayConfigDependencies = createDefaultGatewayConfigDependencies(),
): Promise<GatewayConfigResult<CompanyGatewayConfiguration>> {
  try {
    requireGatewayManage(actor);
    const parsedId = companyIdSchema.safeParse(companyId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }
    const config = await deps.store.getCompanyGatewayConfiguration(parsedId.data);
    if (!config) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }
    return { ok: true, data: toPublicGatewayConfiguration(config) };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

export async function updateGatewayMethodConfiguration(
  actor: AuthorizationPrincipal | null,
  companyId: string,
  methodCodeInput: string,
  input: unknown,
  deps: GatewayConfigDependencies = createDefaultGatewayConfigDependencies(),
): Promise<GatewayConfigResult<CompanyGatewayConfiguration>> {
  try {
    requireGatewayManage(actor);
    const parsedId = companyIdSchema.safeParse(companyId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }
    if (!(await deps.store.companyExists(parsedId.data))) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }

    const methodCodeParsed = paymentMethodCodeSchema.safeParse(methodCodeInput);
    if (!methodCodeParsed.success) {
      return { ok: false, status: 404, error: GATEWAY_METHOD_NOT_FOUND };
    }
    const methodCode = methodCodeParsed.data;

    const parsed = gatewayMethodConfigWriteSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, status: 400, error: GATEWAY_INVALID_INPUT };
    }

    const existing = await deps.store.getCompanyGatewayConfiguration(parsedId.data);
    if (!existing) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }
    const previousMethod = existing.methods.find((method) => method.methodCode === methodCode);

    const updated = await deps.store.updateNonSecretConfig(parsedId.data, methodCode, {
      methodEnabled: parsed.data.methodEnabled,
      environment: parsed.data.environment,
      providerConfig: parsed.data.providerConfig ?? undefined,
    });

    const nextMethod = updated.methods.find((method) => method.methodCode === methodCode);

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor?.userId ?? null,
        companyId: parsedId.data,
        entityType: AuditEntityTypes.PAYMENT_GATEWAY_CONFIG,
        entityId: parsedId.data,
        action: AuditActions.GATEWAY_CONFIG_UPDATED,
        oldValues: safeMethodSummary(previousMethod, methodCode),
        newValues: safeMethodSummary(nextMethod, methodCode),
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "gateway.config_updated",
        actorUserId: actor?.userId,
        companyId: parsedId.data,
        methodCode,
        methodEnabled: nextMethod?.methodEnabled,
        environment: nextMethod?.environment,
        credentialsConfigured: nextMethod?.credentialsConfigured,
        status: nextMethod?.status,
      },
      "Gateway configuration updated",
    );

    return { ok: true, data: toPublicGatewayConfiguration(updated) };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

export async function replaceGatewayMethodCredentials(
  actor: AuthorizationPrincipal | null,
  companyId: string,
  methodCodeInput: string,
  input: unknown,
  deps: GatewayConfigDependencies = createDefaultGatewayConfigDependencies(),
): Promise<GatewayConfigResult<CompanyGatewayConfiguration>> {
  try {
    requireGatewayManage(actor);
    const parsedId = companyIdSchema.safeParse(companyId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }
    if (!(await deps.store.companyExists(parsedId.data))) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }

    const methodCodeParsed = paymentMethodCodeSchema.safeParse(methodCodeInput);
    if (!methodCodeParsed.success) {
      return { ok: false, status: 404, error: GATEWAY_METHOD_NOT_FOUND };
    }
    const methodCode = methodCodeParsed.data;

    const parsed = gatewayCredentialsReplaceSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, status: 400, error: GATEWAY_INVALID_INPUT };
    }

    const existing = await deps.store.getCompanyGatewayConfiguration(parsedId.data);
    if (!existing) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }
    const previousMethod = existing.methods.find((method) => method.methodCode === methodCode);

    let envelope;
    try {
      envelope = credentialServiceOf(deps).encryptCredentials(parsed.data.credentials, {
        companyId: parsedId.data,
        methodCode,
      });
    } catch (error) {
      if (error instanceof GatewayCredentialCryptoError) {
        logger.error(
          {
            event: "gateway.credentials_encrypt_failed",
            companyId: parsedId.data,
            methodCode,
            code: error.code,
          },
          "Gateway credential encryption failed",
        );
        return { ok: false, status: 503, error: GATEWAY_ENCRYPTION_UNAVAILABLE };
      }
      throw error;
    }

    const updated = await deps.store.replaceCredentials(parsedId.data, methodCode, envelope);

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor?.userId ?? null,
        companyId: parsedId.data,
        entityType: AuditEntityTypes.PAYMENT_GATEWAY_CONFIG,
        entityId: parsedId.data,
        action: AuditActions.GATEWAY_CREDENTIALS_REPLACED,
        oldValues: {
          methodCode,
          credentialsConfigured: previousMethod?.credentialsConfigured ?? false,
        },
        newValues: {
          methodCode,
          credentialsConfigured: true,
          kekKeyVersionPresent: true,
          encryptionFormatVersionPresent: true,
        },
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "gateway.credentials_replaced",
        actorUserId: actor?.userId,
        companyId: parsedId.data,
        methodCode,
        credentialsConfigured: true,
      },
      "Gateway credentials replaced",
    );

    return { ok: true, data: toPublicGatewayConfiguration(updated) };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

/**
 * Builds registry-facing config without decrypting credentials (TASK-048 / BR-008).
 */
export async function toPaymentProviderGatewayConfig(
  companyId: string,
  methodCode: PaymentMethodCode,
  deps: GatewayConfigDependencies = createDefaultGatewayConfigDependencies(),
): Promise<PaymentProviderGatewayConfig | null> {
  const row = await deps.store.getMethodRow(companyId, methodCode);
  if (!row) {
    return null;
  }
  return {
    companyId: row.companyId,
    methodCode: row.methodCode,
    enabled: row.enabled,
    environment: row.environment,
    enabledSettlementCurrencyCodes: row.enabledSettlementCurrencyCodes,
    credentialsConfigured: row.credentialsConfigured,
  };
}

function toAuthzOrUnavailable(error: unknown): { ok: false; status: 403 | 503; error: string } {
  if (error && typeof error === "object" && "status" in error && "message" in error) {
    const status = error.status;
    if (status === 401 || status === 403) {
      return {
        ok: false,
        status: 403,
        error:
          typeof error.message === "string"
            ? error.message
            : "You do not have permission to perform this action.",
      };
    }
  }

  if (error instanceof GatewayCredentialCryptoError) {
    return { ok: false, status: 503, error: GATEWAY_ENCRYPTION_UNAVAILABLE };
  }

  logger.error(
    {
      event: "gateway.unavailable",
      err: error instanceof Error ? error.message : "unknown",
    },
    "Gateway configuration failed",
  );
  return { ok: false, status: 503, error: GATEWAY_UNAVAILABLE };
}
