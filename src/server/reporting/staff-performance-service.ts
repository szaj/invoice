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
  assertStaffPerformanceHasNoCommission,
  assertStaffPerformanceHasNoUnlabeledMixedTotal,
  buildStaffPerformanceRows,
  paginateStaffPerformanceRows,
  sortStaffPerformanceRows,
} from "@/domain/reporting/staff-performance";
import {
  resolveStaffPerformanceQuery,
  staffPerformanceQuerySchema,
} from "@/domain/reporting/schema";
import {
  STAFF_PERFORMANCE_FORBIDDEN,
  STAFF_PERFORMANCE_INVALID_INPUT,
  STAFF_PERFORMANCE_UNAVAILABLE,
  type StaffPerformancePayload,
} from "@/domain/reporting/types";
import {
  PrismaStaffPerformanceStore,
  type StaffPerformanceSourceFilters,
} from "@/server/reporting/staff-performance-repository";

export type StaffPerformanceServiceResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 401 | 403 | 503; error: string };

export interface StaffPerformanceServiceDependencies {
  readonly store: Pick<
    PrismaStaffPerformanceStore,
    "listInvoiceRows" | "listPaymentRows" | "listCompanyIdsInReportingGroup"
  >;
}

export function createDefaultStaffPerformanceServiceDependencies(): StaffPerformanceServiceDependencies {
  return {
    store: new PrismaStaffPerformanceStore(),
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
 * Staff Performance for authorized actors (TASK-084 / §13.3).
 * Requires report.view.
 * Admin: all companies; Compliance: assigned; Staff: assigned companies + own/assigned invoices.
 * Metrics: invoices created/sent, value invoiced, collections on assigned invoices — no commission.
 * Does not invent reporting-currency equivalents or unlabeled mixed totals (ADR-011 OPEN).
 */
export async function getStaffPerformance(
  actor: AuthorizationPrincipal | null,
  query: unknown = {},
  deps: StaffPerformanceServiceDependencies = createDefaultStaffPerformanceServiceDependencies(),
): Promise<StaffPerformanceServiceResult<StaffPerformancePayload>> {
  try {
    assertPermission(actor, "report.view");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsed = staffPerformanceQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      return { ok: false, status: 400, error: STAFF_PERFORMANCE_INVALID_INPUT };
    }

    const resolved = resolveStaffPerformanceQuery(parsed.data);

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
          rows: [],
          page: resolved.page,
          pageSize: resolved.pageSize,
          totalCount: 0,
          sortBy: resolved.sortBy,
          sortDir: resolved.sortDir,
        },
      };
    }

    const visibleToStaffUserId = actor.roleCode === "STAFF" ? actor.userId : null;

    const sourceFilters: StaffPerformanceSourceFilters = {
      ...resolved,
      companyIds,
      visibleToStaffUserId,
    };

    const [invoices, payments] = await Promise.all([
      deps.store.listInvoiceRows(sourceFilters),
      deps.store.listPaymentRows(sourceFilters),
    ]);

    const aggregated = buildStaffPerformanceRows(invoices, payments);
    assertStaffPerformanceHasNoUnlabeledMixedTotal(aggregated);
    assertStaffPerformanceHasNoCommission(aggregated);

    const sorted = sortStaffPerformanceRows(aggregated, resolved.sortBy, resolved.sortDir);
    const page = paginateStaffPerformanceRows(sorted, resolved.page, resolved.pageSize);

    return {
      ok: true,
      data: {
        rows: page.rows,
        page: resolved.page,
        pageSize: resolved.pageSize,
        totalCount: page.totalCount,
        sortBy: resolved.sortBy,
        sortDir: resolved.sortDir,
      },
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, status: 403, error: STAFF_PERFORMANCE_FORBIDDEN };
    }
    logger.error(
      {
        event: "staff_performance.failed",
        err: error instanceof Error ? error.message : "unknown",
      },
      "Staff performance load failed",
    );
    return { ok: false, status: 503, error: STAFF_PERFORMANCE_UNAVAILABLE };
  }
}
