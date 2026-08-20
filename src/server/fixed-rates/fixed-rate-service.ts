import "server-only";

import { logger } from "@/lib/logger";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import { AuditActions, AuditEntityTypes } from "@/domain/audit/types";
import { fixedConversionRateCreateSchema } from "@/domain/fixed-rates/schema";
import {
  FIXED_RATE_CURRENCY_NOT_FOUND,
  FIXED_RATE_INVALID_INPUT,
  FIXED_RATE_SAME_CURRENCY,
  FIXED_RATE_UNAVAILABLE,
  type FixedConversionRateRecord,
} from "@/domain/fixed-rates/types";
import {
  getAuditWriter,
  recordAuditEventRequired,
  type AuditWriter,
} from "@/server/audit/audit-service";
import { PrismaFixedConversionRateStore } from "@/server/fixed-rates/fixed-rate-repository";

export type FixedRateResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 403 | 503; error: string };

export interface FixedRateDependencies {
  readonly store: Pick<
    PrismaFixedConversionRateStore,
    "findCurrencyCodes" | "nextVersionNo" | "createVersionAndExpirePrevious" | "listRates"
  >;
  readonly auditWriter?: AuditWriter;
  /** Injectable clock for scheduled vs activated audit classification. */
  readonly now?: () => Date;
}

export function createDefaultFixedRateDependencies(): FixedRateDependencies {
  return {
    store: new PrismaFixedConversionRateStore(),
  };
}

function auditWriterOf(deps: FixedRateDependencies): AuditWriter {
  return deps.auditWriter ?? getAuditWriter();
}

function nowOf(deps: FixedRateDependencies): Date {
  return deps.now?.() ?? new Date();
}

function requireCurrencyManage(actor: AuthorizationPrincipal | null) {
  assertPermission(actor, "currency.manage");
}

function rateAuditSnapshot(rate: FixedConversionRateRecord) {
  return {
    fromCurrency: rate.fromCurrency,
    toCurrency: rate.toCurrency,
    fixedRate: rate.fixedRate,
    versionNo: rate.versionNo,
    frequencyLabel: rate.frequencyLabel,
    validFrom: rate.validFrom.toISOString(),
    validTo: rate.validTo?.toISOString() ?? null,
    status: rate.status,
    notes: rate.notes,
  };
}

export async function listFixedConversionRates(
  actor: AuthorizationPrincipal | null,
  filter: { fromCurrency?: string; toCurrency?: string } = {},
  deps: FixedRateDependencies = createDefaultFixedRateDependencies(),
): Promise<FixedRateResult<FixedConversionRateRecord[]>> {
  try {
    requireCurrencyManage(actor);
    const rates = await deps.store.listRates(filter);
    return { ok: true, data: rates };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

/**
 * Create a new append-only rate version. Prior ACTIVE versions for the pair are
 * expired/closed and retained. Never PATCHes fixed_rate on historical rows.
 */
export async function createFixedConversionRate(
  actor: AuthorizationPrincipal | null,
  input: unknown,
  deps: FixedRateDependencies = createDefaultFixedRateDependencies(),
): Promise<FixedRateResult<FixedConversionRateRecord>> {
  try {
    requireCurrencyManage(actor);

    const parsed = fixedConversionRateCreateSchema.safeParse(input);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message;
      if (message?.includes("must be different")) {
        return { ok: false, status: 400, error: FIXED_RATE_SAME_CURRENCY };
      }
      return { ok: false, status: 400, error: FIXED_RATE_INVALID_INPUT };
    }

    const fromCurrency = parsed.data.fromCurrency;
    const toCurrency = parsed.data.toCurrency;
    const found = await deps.store.findCurrencyCodes([fromCurrency, toCurrency]);
    if (!found.includes(fromCurrency) || !found.includes(toCurrency)) {
      return { ok: false, status: 400, error: FIXED_RATE_CURRENCY_NOT_FOUND };
    }

    const versionNo = await deps.store.nextVersionNo(fromCurrency, toCurrency);
    const { created, expired } = await deps.store.createVersionAndExpirePrevious({
      fromCurrency,
      toCurrency,
      fixedRate: parsed.data.fixedRate,
      versionNo,
      frequencyLabel: parsed.data.frequencyLabel,
      validFrom: parsed.data.validFrom,
      validTo: parsed.data.validTo ?? null,
      notes: parsed.data.notes ?? null,
      createdByUserId: actor?.userId ?? null,
    });

    const writer = auditWriterOf(deps);
    const actorUserId = actor?.userId ?? null;
    const now = nowOf(deps);
    const isScheduled = created.validFrom.getTime() > now.getTime();

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId,
        companyId: null,
        entityType: AuditEntityTypes.FIXED_CONVERSION_RATE,
        entityId: created.id,
        action: AuditActions.FIXED_RATE_CREATED,
        oldValues: null,
        newValues: rateAuditSnapshot(created),
      },
      writer,
    );

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId,
        companyId: null,
        entityType: AuditEntityTypes.FIXED_CONVERSION_RATE,
        entityId: created.id,
        action: isScheduled ? AuditActions.FIXED_RATE_SCHEDULED : AuditActions.FIXED_RATE_ACTIVATED,
        oldValues: null,
        newValues: rateAuditSnapshot(created),
      },
      writer,
    );

    for (const prior of expired) {
      const priorSnapshot = rateAuditSnapshot(prior);
      await recordAuditEventRequired(
        {
          actorType: "USER",
          actorUserId,
          companyId: null,
          entityType: AuditEntityTypes.FIXED_CONVERSION_RATE,
          entityId: prior.id,
          action: AuditActions.FIXED_RATE_EXPIRED,
          oldValues: {
            ...priorSnapshot,
            status: "ACTIVE",
          },
          newValues: priorSnapshot,
        },
        writer,
      );
      await recordAuditEventRequired(
        {
          actorType: "USER",
          actorUserId,
          companyId: null,
          entityType: AuditEntityTypes.FIXED_CONVERSION_RATE,
          entityId: prior.id,
          action: AuditActions.FIXED_RATE_SUPERSEDED,
          oldValues: {
            ...priorSnapshot,
            status: "ACTIVE",
          },
          newValues: {
            ...priorSnapshot,
            supersededByRateId: created.id,
            supersededByVersionNo: created.versionNo,
          },
        },
        writer,
      );
    }

    logger.info(
      {
        event: "fixed_rates.created",
        actorUserId,
        rateId: created.id,
        fromCurrency: created.fromCurrency,
        toCurrency: created.toCurrency,
        versionNo: created.versionNo,
        expiredCount: expired.length,
        lifecycle: isScheduled ? "scheduled" : "activated",
        rateSource: "admin_fixed_rate",
      },
      "Fixed conversion rate version created",
    );

    return { ok: true, data: created };
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
      event: "fixed_rates.unavailable",
      err: error instanceof Error ? error.message : "unknown",
    },
    "Fixed conversion rate operation failed",
  );
  return { ok: false, status: 503, error: FIXED_RATE_UNAVAILABLE };
}
