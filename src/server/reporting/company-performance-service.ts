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
  assertCompanyPerformanceHasNoUnlabeledMixedTotal,
  assertCompanyPerformanceOwnershipIsOriginalCompany,
  buildCompanyPerformanceRows,
  paginateCompanyPerformanceRows,
  sortCompanyPerformanceRows,
} from "@/domain/reporting/company-performance";
import {
  companyPerformanceQuerySchema,
  resolveCompanyPerformanceQuery,
} from "@/domain/reporting/schema";
import {
  COMPANY_PERFORMANCE_FORBIDDEN,
  COMPANY_PERFORMANCE_INVALID_INPUT,
  COMPANY_PERFORMANCE_UNAVAILABLE,
  type CompanyPerformancePayload,
} from "@/domain/reporting/types";
import {
  PrismaCompanyPerformanceStore,
  type CompanyPerformanceSourceFilters,
} from "@/server/reporting/company-performance-repository";

export type CompanyPerformanceServiceResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 401 | 403 | 503; error: string };

export interface CompanyPerformanceServiceDependencies {
  readonly store: Pick<
    PrismaCompanyPerformanceStore,
    "listInvoiceRows" | "listPaymentRows" | "listCompanyIdsInReportingGroup"
  >;
}

export function createDefaultCompanyPerformanceServiceDependencies(): CompanyPerformanceServiceDependencies {
  return {
    store: new PrismaCompanyPerformanceStore(),
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
 * Company Performance for authorized actors (TASK-083 / §13.3).
 * Requires report.view.
 * Admin: all companies; Compliance: assigned; Staff: assigned + own/assigned invoices.
 * KPIs keyed by owning company_id only — reporting group filters scope, never ownership.
 * Does not invent reporting-currency equivalents or unlabeled mixed totals (ADR-011 OPEN).
 */
export async function getCompanyPerformance(
  actor: AuthorizationPrincipal | null,
  query: unknown = {},
  deps: CompanyPerformanceServiceDependencies = createDefaultCompanyPerformanceServiceDependencies(),
): Promise<CompanyPerformanceServiceResult<CompanyPerformancePayload>> {
  try {
    assertPermission(actor, "report.view");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsed = companyPerformanceQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      return { ok: false, status: 400, error: COMPANY_PERFORMANCE_INVALID_INPUT };
    }

    const resolved = resolveCompanyPerformanceQuery(parsed.data);

    let companyIds = resolveReportCompanyScope(actor, resolved.companyId);
    if (resolved.reportingGroupId) {
      const groupCompanyIds = await deps.store.listCompanyIdsInReportingGroup(
        resolved.reportingGroupId,
      );
      // Reporting group narrows which owning companies are included — it is not ownership.
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

    const sourceFilters: CompanyPerformanceSourceFilters = {
      ...resolved,
      companyIds,
      visibleToStaffUserId,
    };

    const [invoices, payments] = await Promise.all([
      deps.store.listInvoiceRows(sourceFilters),
      deps.store.listPaymentRows(sourceFilters),
    ]);

    const aggregated = buildCompanyPerformanceRows(invoices, payments);
    assertCompanyPerformanceHasNoUnlabeledMixedTotal(aggregated);
    assertCompanyPerformanceOwnershipIsOriginalCompany(aggregated, [
      ...new Set([
        ...invoices.map((row) => row.companyId),
        ...payments.map((row) => row.companyId),
      ]),
    ]);

    const sorted = sortCompanyPerformanceRows(aggregated, resolved.sortBy, resolved.sortDir);
    const page = paginateCompanyPerformanceRows(sorted, resolved.page, resolved.pageSize);

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
      return { ok: false, status: 403, error: COMPANY_PERFORMANCE_FORBIDDEN };
    }
    logger.error(
      {
        event: "company_performance.failed",
        err: error instanceof Error ? error.message : "unknown",
      },
      "Company performance load failed",
    );
    return { ok: false, status: 503, error: COMPANY_PERFORMANCE_UNAVAILABLE };
  }
}
