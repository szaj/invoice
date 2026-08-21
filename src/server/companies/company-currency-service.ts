import "server-only";

import { logger } from "@/lib/logger";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import { AuditActions, AuditEntityTypes } from "@/domain/audit/types";
import { companyIdSchema } from "@/domain/companies/company-schema";
import { companyCurrencyConfigWriteSchema } from "@/domain/companies/company-currency-schema";
import {
  COMPANY_CURRENCY_DEFAULT_NOT_ENABLED,
  COMPANY_CURRENCY_DEFAULT_REQUIRED,
  COMPANY_CURRENCY_INACTIVE_GLOBAL,
  COMPANY_CURRENCY_INVALID_INPUT,
  COMPANY_CURRENCY_UNAVAILABLE,
  type CompanyCurrencyConfiguration,
} from "@/domain/companies/company-currency-types";
import { COMPANY_NOT_FOUND_MESSAGE } from "@/domain/companies/types";
import {
  getAuditWriter,
  recordAuditEventRequired,
  type AuditWriter,
} from "@/server/audit/audit-service";
import { PrismaCompanyCurrencyStore } from "@/server/companies/company-currency-repository";

export type CompanyCurrencyResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 403 | 404 | 503; error: string };

export interface CompanyCurrencyDependencies {
  readonly store: Pick<
    PrismaCompanyCurrencyStore,
    | "getCompanyCurrencyConfiguration"
    | "replaceCompanyCurrencies"
    | "findActiveCurrenciesByIds"
    | "companyExists"
  >;
  readonly auditWriter?: AuditWriter;
}

export function createDefaultCompanyCurrencyDependencies(): CompanyCurrencyDependencies {
  return {
    store: new PrismaCompanyCurrencyStore(),
  };
}

function auditWriterOf(deps: CompanyCurrencyDependencies): AuditWriter {
  return deps.auditWriter ?? getAuditWriter();
}

function requireCompanyWrite(actor: AuthorizationPrincipal | null) {
  assertPermission(actor, "company.write");
}

export async function getCompanyCurrencyConfiguration(
  actor: AuthorizationPrincipal | null,
  companyId: string,
  deps: CompanyCurrencyDependencies = createDefaultCompanyCurrencyDependencies(),
): Promise<CompanyCurrencyResult<CompanyCurrencyConfiguration>> {
  try {
    requireCompanyWrite(actor);
    const parsedId = companyIdSchema.safeParse(companyId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }

    const config = await deps.store.getCompanyCurrencyConfiguration(parsedId.data);
    if (!config) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }
    return { ok: true, data: config };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

export async function updateCompanyCurrencyConfiguration(
  actor: AuthorizationPrincipal | null,
  companyId: string,
  input: unknown,
  deps: CompanyCurrencyDependencies = createDefaultCompanyCurrencyDependencies(),
): Promise<CompanyCurrencyResult<CompanyCurrencyConfiguration>> {
  try {
    requireCompanyWrite(actor);
    const parsedId = companyIdSchema.safeParse(companyId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }

    if (!(await deps.store.companyExists(parsedId.data))) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }

    const parsed = companyCurrencyConfigWriteSchema.safeParse(input);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message;
      if (message?.includes("default invoice currency must be")) {
        return { ok: false, status: 400, error: COMPANY_CURRENCY_DEFAULT_NOT_ENABLED };
      }
      if (message?.includes("Choose a default")) {
        return { ok: false, status: 400, error: COMPANY_CURRENCY_DEFAULT_REQUIRED };
      }
      return { ok: false, status: 400, error: COMPANY_CURRENCY_INVALID_INPUT };
    }

    const enabledIds = parsed.data.enabledCurrencyIds;
    if (enabledIds.length > 0) {
      const active = await deps.store.findActiveCurrenciesByIds(enabledIds);
      if (active.length !== enabledIds.length) {
        return { ok: false, status: 400, error: COMPANY_CURRENCY_INACTIVE_GLOBAL };
      }
    }

    const existing = await deps.store.getCompanyCurrencyConfiguration(parsedId.data);
    if (!existing) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }

    // New selection path only accepts ACTIVE ids; historical INACTIVE assignments
    // are preserved inside replaceCompanyCurrencies (BR-011).
    const updated = await deps.store.replaceCompanyCurrencies(parsedId.data, {
      enabledCurrencyIds: enabledIds,
      defaultCurrencyId: enabledIds.length === 0 ? null : parsed.data.defaultCurrencyId,
    });

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor?.userId ?? null,
        companyId: parsedId.data,
        entityType: AuditEntityTypes.COMPANY,
        entityId: parsedId.data,
        action: AuditActions.COMPANY_CURRENCIES_UPDATED,
        oldValues: {
          enabledCurrencyIds: existing.enabledCurrencyIds,
          defaultCurrencyId: existing.defaultCurrencyId,
        },
        newValues: {
          enabledCurrencyIds: updated.enabledCurrencyIds,
          defaultCurrencyId: updated.defaultCurrencyId,
        },
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "companies.currencies_updated",
        actorUserId: actor?.userId,
        companyId: parsedId.data,
        enabledCount: updated.enabledCurrencyIds.length,
        defaultCurrencyId: updated.defaultCurrencyId,
      },
      "Company currencies updated",
    );

    return { ok: true, data: updated };
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
      event: "companies.currencies_unavailable",
      err: error instanceof Error ? error.message : "unknown",
    },
    "Company currency settings failed",
  );
  return { ok: false, status: 503, error: COMPANY_CURRENCY_UNAVAILABLE };
}
