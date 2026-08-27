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
  assertMonthlyBrandMatrixUsesReportingCurrency,
  buildMonthlyBrandMatrix,
} from "@/domain/reporting/monthly-brand-matrix";
import {
  monthlyBrandMatrixQuerySchema,
  resolveMonthlyBrandMatrixQuery,
} from "@/domain/reporting/schema";
import {
  MONTHLY_BRAND_MATRIX_FORBIDDEN,
  MONTHLY_BRAND_MATRIX_INVALID_INPUT,
  MONTHLY_BRAND_MATRIX_SETTINGS_MISSING,
  MONTHLY_BRAND_MATRIX_UNAVAILABLE,
  type MonthlyBrandMatrixPayload,
} from "@/domain/reporting/types";
import { PrismaFixedConversionRateStore } from "@/server/fixed-rates/fixed-rate-repository";
import {
  PrismaMonthlyBrandMatrixStore,
  type MonthlyBrandMatrixSourceFilters,
} from "@/server/reporting/monthly-brand-matrix-repository";
import { PrismaSystemSettingsStore } from "@/server/settings/settings-repository";

export type MonthlyBrandMatrixServiceResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 401 | 403 | 503; error: string };

export interface MonthlyBrandMatrixServiceDependencies {
  readonly store: Pick<
    PrismaMonthlyBrandMatrixStore,
    | "listPaymentRows"
    | "listAdjustmentRows"
    | "listCompanyColumns"
    | "listCompanyIdsInReportingGroup"
    | "loadReportingCurrencyPrecision"
  >;
  readonly settingsStore: Pick<PrismaSystemSettingsStore, "getSettings">;
  readonly fixedRateStore: Pick<PrismaFixedConversionRateStore, "listRates">;
}

export function createDefaultMonthlyBrandMatrixServiceDependencies(): MonthlyBrandMatrixServiceDependencies {
  return {
    store: new PrismaMonthlyBrandMatrixStore(),
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
 * Monthly Brand / CB-RF Matrix for authorized actors (TASK-088 / §13.3.1).
 * Requires report.view. Gross by payment date; CB/RF by adjustment effective date (BR-024 / BR-026).
 */
export async function getMonthlyBrandMatrix(
  actor: AuthorizationPrincipal | null,
  query: unknown = {},
  deps: MonthlyBrandMatrixServiceDependencies = createDefaultMonthlyBrandMatrixServiceDependencies(),
): Promise<MonthlyBrandMatrixServiceResult<MonthlyBrandMatrixPayload>> {
  try {
    assertPermission(actor, "report.view");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsed = monthlyBrandMatrixQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      return { ok: false, status: 400, error: MONTHLY_BRAND_MATRIX_INVALID_INPUT };
    }

    const resolved = resolveMonthlyBrandMatrixQuery(parsed.data);
    const settings = await deps.settingsStore.getSettings();
    if (!settings?.reportingCurrencyCode) {
      return { ok: false, status: 503, error: MONTHLY_BRAND_MATRIX_SETTINGS_MISSING };
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
      const empty = buildMonthlyBrandMatrix({
        year: resolved.year,
        reportingCurrencyCode: settings.reportingCurrencyCode,
        decimalPrecision,
        companies: [],
        payments: [],
        adjustments: [],
        fixedRates: [],
      });
      return { ok: true, data: empty.payload };
    }

    const sourceFilters: MonthlyBrandMatrixSourceFilters = {
      ...resolved,
      companyIds,
      ...(actor.roleCode === "STAFF" ? { visibleToStaffUserId: actor.userId } : {}),
    };

    const [companies, payments, adjustments, fixedRates, decimalPrecision] = await Promise.all([
      deps.store.listCompanyColumns(companyIds),
      deps.store.listPaymentRows(sourceFilters),
      deps.store.listAdjustmentRows(sourceFilters),
      deps.fixedRateStore.listRates(),
      deps.store.loadReportingCurrencyPrecision(settings.reportingCurrencyCode),
    ]);

    const built = buildMonthlyBrandMatrix({
      year: resolved.year,
      reportingCurrencyCode: settings.reportingCurrencyCode,
      decimalPrecision,
      companies,
      payments,
      adjustments,
      fixedRates,
    });

    assertMonthlyBrandMatrixUsesReportingCurrency(built.payload);
    return { ok: true, data: built.payload };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, status: 403, error: MONTHLY_BRAND_MATRIX_FORBIDDEN };
    }
    logger.error({ err: error }, "monthly brand matrix unavailable");
    return { ok: false, status: 503, error: MONTHLY_BRAND_MATRIX_UNAVAILABLE };
  }
}
