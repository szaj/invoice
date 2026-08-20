import "server-only";

import { Prisma } from "@/generated/prisma/client";

import { logger } from "@/lib/logger";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import { AuditActions, AuditEntityTypes } from "@/domain/audit/types";
import {
  currencyIdSchema,
  currencyStatusUpdateSchema,
  currencyUpdateSchema,
  currencyWriteSchema,
} from "@/domain/currencies/schema";
import {
  CURRENCY_CODE_CONFLICT,
  CURRENCY_INVALID_INPUT,
  CURRENCY_NOT_FOUND,
  CURRENCY_UNAVAILABLE,
  type CurrencyRecord,
  type CurrencyStatus,
} from "@/domain/currencies/types";
import {
  getAuditWriter,
  recordAuditEventRequired,
  type AuditWriter,
} from "@/server/audit/audit-service";
import { PrismaCurrencyStore } from "@/server/currencies/currency-repository";

export type CurrencyManagementResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 403 | 404 | 409 | 503; error: string };

export interface CurrencyManagementDependencies {
  readonly store: Pick<
    PrismaCurrencyStore,
    | "listCurrencies"
    | "getCurrencyById"
    | "findByCode"
    | "createCurrency"
    | "updateCurrency"
    | "setStatus"
  >;
  readonly auditWriter?: AuditWriter;
}

export function createDefaultCurrencyManagementDependencies(): CurrencyManagementDependencies {
  return {
    store: new PrismaCurrencyStore(),
  };
}

function auditWriterOf(deps: CurrencyManagementDependencies): AuditWriter {
  return deps.auditWriter ?? getAuditWriter();
}

function requireCurrencyManage(actor: AuthorizationPrincipal | null) {
  assertPermission(actor, "currency.manage");
}

function currencyAuditSnapshot(currency: CurrencyRecord) {
  return {
    code: currency.code,
    name: currency.name,
    symbol: currency.symbol,
    decimalPrecision: currency.decimalPrecision,
    status: currency.status,
  };
}

export async function listCurrencies(
  actor: AuthorizationPrincipal | null,
  deps: CurrencyManagementDependencies = createDefaultCurrencyManagementDependencies(),
): Promise<CurrencyManagementResult<CurrencyRecord[]>> {
  try {
    requireCurrencyManage(actor);
    const currencies = await deps.store.listCurrencies();
    return { ok: true, data: currencies };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

export async function getCurrency(
  actor: AuthorizationPrincipal | null,
  currencyId: string,
  deps: CurrencyManagementDependencies = createDefaultCurrencyManagementDependencies(),
): Promise<CurrencyManagementResult<CurrencyRecord>> {
  try {
    requireCurrencyManage(actor);
    const parsedId = currencyIdSchema.safeParse(currencyId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: CURRENCY_NOT_FOUND };
    }
    const currency = await deps.store.getCurrencyById(parsedId.data);
    if (!currency) {
      return { ok: false, status: 404, error: CURRENCY_NOT_FOUND };
    }
    return { ok: true, data: currency };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

export async function createCurrency(
  actor: AuthorizationPrincipal | null,
  input: unknown,
  deps: CurrencyManagementDependencies = createDefaultCurrencyManagementDependencies(),
): Promise<CurrencyManagementResult<CurrencyRecord>> {
  try {
    requireCurrencyManage(actor);
    const parsed = currencyWriteSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, status: 400, error: CURRENCY_INVALID_INPUT };
    }

    const existing = await deps.store.findByCode(parsed.data.code);
    if (existing) {
      return { ok: false, status: 409, error: CURRENCY_CODE_CONFLICT };
    }

    const created = await deps.store.createCurrency({
      code: parsed.data.code,
      name: parsed.data.name,
      symbol: parsed.data.symbol,
      decimalPrecision: parsed.data.decimalPrecision,
      status: parsed.data.status,
    });

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor?.userId ?? null,
        entityType: AuditEntityTypes.CURRENCY,
        entityId: created.id,
        action: AuditActions.CURRENCY_CREATED,
        newValues: currencyAuditSnapshot(created),
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "currencies.created",
        actorUserId: actor?.userId,
        currencyId: created.id,
        code: created.code,
      },
      "Currency created",
    );

    return { ok: true, data: created };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, status: 409, error: CURRENCY_CODE_CONFLICT };
    }
    return toAuthzOrUnavailable(error);
  }
}

export async function updateCurrency(
  actor: AuthorizationPrincipal | null,
  currencyId: string,
  input: unknown,
  deps: CurrencyManagementDependencies = createDefaultCurrencyManagementDependencies(),
): Promise<CurrencyManagementResult<CurrencyRecord>> {
  try {
    requireCurrencyManage(actor);
    const parsedId = currencyIdSchema.safeParse(currencyId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: CURRENCY_NOT_FOUND };
    }

    const parsed = currencyUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, status: 400, error: CURRENCY_INVALID_INPUT };
    }

    const existing = await deps.store.getCurrencyById(parsedId.data);
    if (!existing) {
      return { ok: false, status: 404, error: CURRENCY_NOT_FOUND };
    }

    const updated = await deps.store.updateCurrency(parsedId.data, {
      name: parsed.data.name,
      symbol: parsed.data.symbol,
      decimalPrecision: parsed.data.decimalPrecision,
      status: parsed.data.status,
    });

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor?.userId ?? null,
        entityType: AuditEntityTypes.CURRENCY,
        entityId: updated.id,
        action: AuditActions.CURRENCY_UPDATED,
        oldValues: currencyAuditSnapshot(existing),
        newValues: currencyAuditSnapshot(updated),
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "currencies.updated",
        actorUserId: actor?.userId,
        currencyId: updated.id,
        code: updated.code,
        status: updated.status,
      },
      "Currency updated",
    );

    return { ok: true, data: updated };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

export async function setCurrencyStatus(
  actor: AuthorizationPrincipal | null,
  currencyId: string,
  input: unknown,
  deps: CurrencyManagementDependencies = createDefaultCurrencyManagementDependencies(),
): Promise<CurrencyManagementResult<CurrencyRecord>> {
  try {
    requireCurrencyManage(actor);
    const parsedId = currencyIdSchema.safeParse(currencyId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: CURRENCY_NOT_FOUND };
    }

    const parsed = currencyStatusUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, status: 400, error: CURRENCY_INVALID_INPUT };
    }

    const existing = await deps.store.getCurrencyById(parsedId.data);
    if (!existing) {
      return { ok: false, status: 404, error: CURRENCY_NOT_FOUND };
    }

    const updated = await deps.store.setStatus(parsedId.data, parsed.data.status as CurrencyStatus);

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor?.userId ?? null,
        entityType: AuditEntityTypes.CURRENCY,
        entityId: updated.id,
        action: AuditActions.CURRENCY_STATUS_CHANGED,
        oldValues: { status: existing.status },
        newValues: { status: updated.status },
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "currencies.status_changed",
        actorUserId: actor?.userId,
        currencyId: updated.id,
        code: updated.code,
        status: updated.status,
      },
      "Currency status changed",
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
    { event: "currencies.unavailable", err: error instanceof Error ? error.message : "unknown" },
    "Currency management failed",
  );
  return { ok: false, status: 503, error: CURRENCY_UNAVAILABLE };
}
