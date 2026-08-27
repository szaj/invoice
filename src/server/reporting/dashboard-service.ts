import "server-only";

import { logger } from "@/lib/logger";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import {
  assertCompanyAccess,
  assignedCompanyIdsOf,
  companyScopeForRole,
} from "@/domain/authz/company-access";
import { AuthorizationError } from "@/domain/authz/errors";
import { buildDashboardKpis } from "@/domain/reporting/dashboard-kpis";
import { dashboardKpiQuerySchema } from "@/domain/reporting/schema";
import {
  DASHBOARD_FORBIDDEN,
  DASHBOARD_INVALID_INPUT,
  DASHBOARD_UNAVAILABLE,
  type DashboardKpiPayload,
} from "@/domain/reporting/types";
import {
  PrismaDashboardStore,
  type DashboardSourceFilters,
} from "@/server/reporting/dashboard-repository";

export type DashboardServiceResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 401 | 403 | 503; error: string };

export interface DashboardServiceDependencies {
  readonly store: Pick<
    PrismaDashboardStore,
    "listInvoiceRows" | "listPaymentRows" | "listCompanyIdsInReportingGroup"
  >;
}

export function createDefaultDashboardServiceDependencies(): DashboardServiceDependencies {
  return {
    store: new PrismaDashboardStore(),
  };
}

function resolveDashboardCompanyScope(
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
 * Dashboard KPI payload for authorized actors (TASK-077).
 * Requires dashboard.view. Staff is scoped to assigned companies and own/assigned invoices.
 * Does not invent reporting-currency equivalents while ADR-011 is OPEN.
 */
export async function getDashboardKpis(
  actor: AuthorizationPrincipal | null,
  query: unknown = {},
  deps: DashboardServiceDependencies = createDefaultDashboardServiceDependencies(),
): Promise<DashboardServiceResult<DashboardKpiPayload>> {
  try {
    assertPermission(actor, "dashboard.view");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsed = dashboardKpiQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      return { ok: false, status: 400, error: DASHBOARD_INVALID_INPUT };
    }

    let companyIds = resolveDashboardCompanyScope(actor, parsed.data.companyId);
    if (parsed.data.reportingGroupId) {
      const groupCompanyIds = await deps.store.listCompanyIdsInReportingGroup(
        parsed.data.reportingGroupId,
      );
      companyIds = intersectCompanyIds(companyIds, groupCompanyIds);
    }

    if (companyIds !== "ALL" && companyIds.length === 0) {
      return {
        ok: true,
        data: {
          invoiceCurrencies: [],
          settlementCurrencies: [],
          invoiceCountsByStatus: [],
          paymentCountsByMethodStatus: [],
        },
      };
    }

    const visibleToStaffUserId = actor.roleCode === "STAFF" ? actor.userId : null;

    const sourceFilters: DashboardSourceFilters = {
      ...parsed.data,
      companyIds,
      visibleToStaffUserId,
    };

    const [invoices, payments] = await Promise.all([
      deps.store.listInvoiceRows(sourceFilters),
      deps.store.listPaymentRows(sourceFilters),
    ]);

    const payload = buildDashboardKpis(invoices, payments);
    return { ok: true, data: payload };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, status: 403, error: DASHBOARD_FORBIDDEN };
    }
    logger.error(
      {
        event: "dashboard.kpis_failed",
        err: error instanceof Error ? error.message : "unknown",
      },
      "Dashboard KPI load failed",
    );
    return { ok: false, status: 503, error: DASHBOARD_UNAVAILABLE };
  }
}
