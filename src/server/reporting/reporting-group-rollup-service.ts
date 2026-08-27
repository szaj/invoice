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
  assertReportingGroupRollupHasNoUnlabeledMixedTotal,
  assertReportingGroupRollupOwnershipIsMemberCompany,
  buildReportingGroupRollupRows,
} from "@/domain/reporting/reporting-group-rollup";
import {
  reportingGroupRollupQuerySchema,
  resolveReportingGroupRollupQuery,
} from "@/domain/reporting/schema";
import {
  REPORTING_GROUP_ROLLUP_FORBIDDEN,
  REPORTING_GROUP_ROLLUP_INVALID_INPUT,
  REPORTING_GROUP_ROLLUP_SETTINGS_MISSING,
  REPORTING_GROUP_ROLLUP_UNAVAILABLE,
  type ReportingGroupRollupPayload,
} from "@/domain/reporting/types";
import { PrismaFixedConversionRateStore } from "@/server/fixed-rates/fixed-rate-repository";
import {
  PrismaReportingGroupRollupStore,
  type ReportingGroupRollupMatrixFilters,
  type ReportingGroupRollupSourceFilters,
} from "@/server/reporting/reporting-group-rollup-repository";
import { PrismaSystemSettingsStore } from "@/server/settings/settings-repository";

export type ReportingGroupRollupServiceResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 401 | 403 | 503; error: string };

export interface ReportingGroupRollupServiceDependencies {
  readonly store: Pick<
    PrismaReportingGroupRollupStore,
    | "listReportingGroupsInScope"
    | "listInvoiceRows"
    | "listPaymentRows"
    | "listMatrixPaymentRows"
    | "listMatrixAdjustmentRows"
    | "listCompanyIdsInReportingGroup"
    | "loadReportingCurrencyPrecision"
  >;
  readonly settingsStore: Pick<PrismaSystemSettingsStore, "getSettings">;
  readonly fixedRateStore: Pick<PrismaFixedConversionRateStore, "listRates">;
}

export function createDefaultReportingGroupRollupServiceDependencies(): ReportingGroupRollupServiceDependencies {
  return {
    store: new PrismaReportingGroupRollupStore(),
    settingsStore: new PrismaSystemSettingsStore(),
    fixedRateStore: new PrismaFixedConversionRateStore(),
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
 * Reporting Group Rollups for authorized actors (TASK-089 / §13.3).
 * Requires report.view. KPIs and monthly-matrix summaries roll up by reporting group.
 * Group membership narrows scope only — never grants access to unassigned companies.
 */
export async function getReportingGroupRollups(
  actor: AuthorizationPrincipal | null,
  query: unknown = {},
  deps: ReportingGroupRollupServiceDependencies = createDefaultReportingGroupRollupServiceDependencies(),
): Promise<ReportingGroupRollupServiceResult<ReportingGroupRollupPayload>> {
  try {
    assertPermission(actor, "report.view");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsed = reportingGroupRollupQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      return { ok: false, status: 400, error: REPORTING_GROUP_ROLLUP_INVALID_INPUT };
    }

    const resolved = resolveReportingGroupRollupQuery(parsed.data);
    const settings = await deps.settingsStore.getSettings();
    if (!settings?.reportingCurrencyCode) {
      return { ok: false, status: 503, error: REPORTING_GROUP_ROLLUP_SETTINGS_MISSING };
    }

    let companyIds = resolveReportCompanyScope(actor, resolved.companyId);
    if (resolved.reportingGroupId) {
      const groupCompanyIds = await deps.store.listCompanyIdsInReportingGroup(
        resolved.reportingGroupId,
      );
      companyIds = intersectCompanyIds(companyIds, groupCompanyIds);
    }

    if (companyIds !== "ALL" && companyIds.length === 0) {
      const decimalPrecision = await deps.store.loadReportingCurrencyPrecision(
        settings.reportingCurrencyCode,
      );
      return {
        ok: true,
        data: {
          year: resolved.year,
          reportingCurrencyCode: settings.reportingCurrencyCode,
          reportingCurrencyLabel: `${settings.reportingCurrencyCode} reporting equivalent`,
          decimalPrecision,
          rows: [],
        },
      };
    }

    const visibleToStaffUserId = actor.roleCode === "STAFF" ? actor.userId : null;

    const sourceFilters: ReportingGroupRollupSourceFilters = {
      ...resolved,
      companyIds,
      visibleToStaffUserId,
    };
    const matrixFilters: ReportingGroupRollupMatrixFilters = {
      ...sourceFilters,
      year: resolved.year,
    };

    const [
      groups,
      invoices,
      payments,
      matrixPayments,
      matrixAdjustments,
      fixedRates,
      decimalPrecision,
    ] = await Promise.all([
      deps.store.listReportingGroupsInScope(companyIds, resolved.reportingGroupId),
      deps.store.listInvoiceRows(sourceFilters),
      deps.store.listPaymentRows(sourceFilters),
      deps.store.listMatrixPaymentRows(matrixFilters),
      deps.store.listMatrixAdjustmentRows(matrixFilters),
      deps.fixedRateStore.listRates(),
      deps.store.loadReportingCurrencyPrecision(settings.reportingCurrencyCode),
    ]);

    const rows = buildReportingGroupRollupRows({
      groups,
      invoices,
      payments,
      matrixPayments,
      matrixAdjustments,
      fixedRates,
      year: resolved.year,
      reportingCurrencyCode: settings.reportingCurrencyCode,
      decimalPrecision,
    });

    assertReportingGroupRollupHasNoUnlabeledMixedTotal(rows);
    assertReportingGroupRollupOwnershipIsMemberCompany(rows, [
      ...new Set([
        ...invoices.map((row) => row.companyId),
        ...payments.map((row) => row.companyId),
      ]),
    ]);

    return {
      ok: true,
      data: {
        year: resolved.year,
        reportingCurrencyCode: settings.reportingCurrencyCode,
        reportingCurrencyLabel: `${settings.reportingCurrencyCode} reporting equivalent`,
        decimalPrecision,
        rows,
      },
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, status: 403, error: REPORTING_GROUP_ROLLUP_FORBIDDEN };
    }
    logger.error({ err: error }, "reporting group rollups unavailable");
    return { ok: false, status: 503, error: REPORTING_GROUP_ROLLUP_UNAVAILABLE };
  }
}
