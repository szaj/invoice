import "server-only";

import { logger } from "@/lib/logger";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import {
  assertCompanyAccess,
  assignedCompanyIdsOf,
  companyScopeForRole,
} from "@/domain/authz/company-access";
import { AuthorizationError } from "@/domain/authz/errors";
import {
  assertCurrencyReportFeesSeparateFromSettlement,
  assertCurrencyReportHasNoUnlabeledMixedTotal,
  buildCurrencyReport,
} from "@/domain/reporting/currency-report";
import { currencyReportQuerySchema, resolveCurrencyReportQuery } from "@/domain/reporting/schema";
import {
  CURRENCY_REPORT_FORBIDDEN,
  CURRENCY_REPORT_INVALID_INPUT,
  CURRENCY_REPORT_UNAVAILABLE,
  type CurrencyReportPayload,
} from "@/domain/reporting/types";
import {
  PrismaCurrencyReportStore,
  type CurrencyReportSourceFilters,
} from "@/server/reporting/currency-report-repository";

export type CurrencyReportServiceResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 401 | 403 | 503; error: string };

export interface CurrencyReportServiceDependencies {
  readonly store: Pick<
    PrismaCurrencyReportStore,
    "listInvoiceRows" | "listPaymentRows" | "listCompanyIdsInReportingGroup"
  >;
}

export function createDefaultCurrencyReportServiceDependencies(): CurrencyReportServiceDependencies {
  return {
    store: new PrismaCurrencyReportStore(),
  };
}

function resolveReportCompanyScope(
  actor: AuthorizationPrincipal,
  companyId: string | undefined,
): readonly string[] | "ALL" {
  if (companyId) {
    assertCompanyAccess(actor, companyId);
    return [companyId];
  }
  if (companyScopeForRole(actor.roleCode) === "ALL") {
    return "ALL";
  }
  return [...assignedCompanyIdsOf(actor)];
}

function intersectCompanyIds(
  scope: readonly string[] | "ALL",
  groupCompanyIds: readonly string[],
): readonly string[] | "ALL" {
  if (groupCompanyIds.length === 0) {
    return [];
  }
  if (scope === "ALL") {
    return [...groupCompanyIds];
  }
  const allowed = new Set(scope);
  return groupCompanyIds.filter((id) => allowed.has(id));
}

/**
 * Currency Report for authorized actors (TASK-086 / §13.3).
 * Requires report.view.
 * Admin: all companies; Compliance: assigned; Staff: assigned + own/assigned invoices.
 * Invoice totals by invoice currency; settlement totals by settlement currency.
 * Does not invent reporting-currency equivalents or unlabeled mixed totals (ADR-011 OPEN).
 */
export async function getCurrencyReport(
  actor: AuthorizationPrincipal | null,
  query: unknown = {},
  deps: CurrencyReportServiceDependencies = createDefaultCurrencyReportServiceDependencies(),
): Promise<CurrencyReportServiceResult<CurrencyReportPayload>> {
  try {
    assertPermission(actor, "report.view");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsed = currencyReportQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      return { ok: false, status: 400, error: CURRENCY_REPORT_INVALID_INPUT };
    }

    const resolved = resolveCurrencyReportQuery(parsed.data);

    let companyIds = resolveReportCompanyScope(actor, resolved.companyId);
    if (resolved.reportingGroupId) {
      const groupCompanyIds = await deps.store.listCompanyIdsInReportingGroup(
        resolved.reportingGroupId,
      );
      companyIds = intersectCompanyIds(companyIds, groupCompanyIds);
    }

    if (companyIds !== "ALL" && companyIds.length === 0) {
      return {
        ok: true,
        data: {
          invoiceCurrencies: [],
          settlementCurrencies: [],
          sortBy: resolved.sortBy,
          sortDir: resolved.sortDir,
        },
      };
    }

    const visibleToStaffUserId = actor.roleCode === "STAFF" ? actor.userId : null;

    const sourceFilters: CurrencyReportSourceFilters = {
      ...resolved,
      companyIds,
      visibleToStaffUserId,
    };

    const [invoices, payments] = await Promise.all([
      deps.store.listInvoiceRows(sourceFilters),
      deps.store.listPaymentRows(sourceFilters),
    ]);

    const report = buildCurrencyReport(invoices, payments, {
      sortBy: resolved.sortBy,
      sortDir: resolved.sortDir,
    });
    assertCurrencyReportHasNoUnlabeledMixedTotal(report);
    assertCurrencyReportFeesSeparateFromSettlement(report, payments);

    return { ok: true, data: report };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, status: 403, error: CURRENCY_REPORT_FORBIDDEN };
    }
    logger.error(
      {
        event: "currency_report.failed",
        err: error instanceof Error ? error.message : "unknown",
      },
      "Currency report load failed",
    );
    return { ok: false, status: 503, error: CURRENCY_REPORT_UNAVAILABLE };
  }
}
