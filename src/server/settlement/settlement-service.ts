import "server-only";

import { logger } from "@/lib/logger";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import { AuditActions, AuditEntityTypes } from "@/domain/audit/types";
import { companyIdSchema } from "@/domain/companies/company-schema";
import { COMPANY_NOT_FOUND_MESSAGE } from "@/domain/companies/types";
import { assertSettlementCurrencyEnabled } from "@/domain/settlement/assert-enabled";
import {
  paymentMethodCodeSchema,
  paymentMethodSettlementWriteSchema,
} from "@/domain/settlement/schema";
import {
  SETTLEMENT_CURRENCY_INACTIVE_GLOBAL,
  SETTLEMENT_CURRENCY_NOT_ENABLED,
  SETTLEMENT_INVALID_INPUT,
  SETTLEMENT_METHOD_NOT_FOUND,
  SETTLEMENT_UNAVAILABLE,
  type CompanySettlementConfiguration,
  type PaymentMethodCode,
} from "@/domain/settlement/types";
import {
  getAuditWriter,
  recordAuditEventRequired,
  type AuditWriter,
} from "@/server/audit/audit-service";
import { PrismaSettlementConfigStore } from "@/server/settlement/settlement-repository";

export type SettlementResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 403 | 404 | 503; error: string };

export interface SettlementDependencies {
  readonly store: Pick<
    PrismaSettlementConfigStore,
    | "companyExists"
    | "getCompanySettlementConfiguration"
    | "findActiveCurrencyCodes"
    | "replaceMethodSettlementConfig"
  >;
  readonly auditWriter?: AuditWriter;
}

export function createDefaultSettlementDependencies(): SettlementDependencies {
  return {
    store: new PrismaSettlementConfigStore(),
  };
}

function auditWriterOf(deps: SettlementDependencies): AuditWriter {
  return deps.auditWriter ?? getAuditWriter();
}

function requireGatewayManage(actor: AuthorizationPrincipal | null) {
  assertPermission(actor, "gateway.credentials.manage");
}

export async function getCompanySettlementConfiguration(
  actor: AuthorizationPrincipal | null,
  companyId: string,
  deps: SettlementDependencies = createDefaultSettlementDependencies(),
): Promise<SettlementResult<CompanySettlementConfiguration>> {
  try {
    requireGatewayManage(actor);
    const parsedId = companyIdSchema.safeParse(companyId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }
    const config = await deps.store.getCompanySettlementConfiguration(parsedId.data);
    if (!config) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }
    return { ok: true, data: config };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

export async function updatePaymentMethodSettlementConfiguration(
  actor: AuthorizationPrincipal | null,
  companyId: string,
  methodCodeInput: string,
  input: unknown,
  deps: SettlementDependencies = createDefaultSettlementDependencies(),
): Promise<SettlementResult<CompanySettlementConfiguration>> {
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
      return { ok: false, status: 404, error: SETTLEMENT_METHOD_NOT_FOUND };
    }
    const methodCode = methodCodeParsed.data;

    const parsed = paymentMethodSettlementWriteSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, status: 400, error: SETTLEMENT_INVALID_INPUT };
    }

    const uniqueCodes = [...new Set(parsed.data.enabledSettlementCurrencyCodes)];
    if (uniqueCodes.length !== parsed.data.enabledSettlementCurrencyCodes.length) {
      return { ok: false, status: 400, error: SETTLEMENT_INVALID_INPUT };
    }

    if (uniqueCodes.length > 0) {
      const active = await deps.store.findActiveCurrencyCodes(uniqueCodes);
      if (active.length !== uniqueCodes.length) {
        return { ok: false, status: 400, error: SETTLEMENT_CURRENCY_INACTIVE_GLOBAL };
      }
    }

    const existing = await deps.store.getCompanySettlementConfiguration(parsedId.data);
    if (!existing) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }
    const previousMethod = existing.methods.find((method) => method.methodCode === methodCode);

    const updated = await deps.store.replaceMethodSettlementConfig(parsedId.data, methodCode, {
      methodEnabled: parsed.data.methodEnabled,
      enabledSettlementCurrencyCodes: uniqueCodes,
    });

    const nextMethod = updated.methods.find((method) => method.methodCode === methodCode);

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor?.userId ?? null,
        companyId: parsedId.data,
        entityType: AuditEntityTypes.PAYMENT_GATEWAY_CONFIG,
        entityId: parsedId.data,
        action: AuditActions.SETTLEMENT_CURRENCIES_UPDATED,
        oldValues: previousMethod
          ? {
              methodCode,
              methodEnabled: previousMethod.methodEnabled,
              enabledSettlementCurrencyCodes: previousMethod.enabledSettlementCurrencyCodes,
            }
          : null,
        newValues: {
          methodCode,
          methodEnabled: nextMethod?.methodEnabled ?? parsed.data.methodEnabled,
          enabledSettlementCurrencyCodes: uniqueCodes,
        },
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "settlement.currencies_updated",
        actorUserId: actor?.userId,
        companyId: parsedId.data,
        methodCode,
        methodEnabled: parsed.data.methodEnabled,
        enabledCount: uniqueCodes.length,
      },
      "Settlement currencies updated",
    );

    return { ok: true, data: updated };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

/**
 * BR-006 enforcement helper for later payment flows (no live charges here).
 */
export async function validateSettlementCurrencyForMethod(
  actor: AuthorizationPrincipal | null,
  companyId: string,
  methodCode: PaymentMethodCode,
  settlementCurrencyCode: string,
  deps: SettlementDependencies = createDefaultSettlementDependencies(),
): Promise<SettlementResult<{ methodCode: PaymentMethodCode; settlementCurrencyCode: string }>> {
  try {
    requireGatewayManage(actor);
    const parsedId = companyIdSchema.safeParse(companyId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }
    const config = await deps.store.getCompanySettlementConfiguration(parsedId.data);
    if (!config) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }
    const method = config.methods.find((row) => row.methodCode === methodCode);
    const check = assertSettlementCurrencyEnabled(method, settlementCurrencyCode);
    if (!check.ok) {
      return { ok: false, status: 400, error: SETTLEMENT_CURRENCY_NOT_ENABLED };
    }
    return {
      ok: true,
      data: {
        methodCode,
        settlementCurrencyCode: settlementCurrencyCode.trim().toUpperCase(),
      },
    };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
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

  logger.error(
    {
      event: "settlement.unavailable",
      err: error instanceof Error ? error.message : "unknown",
    },
    "Settlement currency settings failed",
  );
  return { ok: false, status: 503, error: SETTLEMENT_UNAVAILABLE };
}
