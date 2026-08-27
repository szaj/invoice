import "server-only";

import { logger } from "@/lib/logger";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import {
  assertCompanyAccess,
  assignedCompanyIdsOf,
  companyScopeForRole,
} from "@/domain/authz/company-access";
import { AuthorizationError } from "@/domain/authz/errors";
import { assertOutstandingReportUsesStoredBalance } from "@/domain/reporting/outstanding-report";
import {
  outstandingReportQuerySchema,
  resolveOutstandingReportQuery,
} from "@/domain/reporting/schema";
import {
  OUTSTANDING_REPORT_FORBIDDEN,
  OUTSTANDING_REPORT_INVALID_INPUT,
  OUTSTANDING_REPORT_UNAVAILABLE,
  type OutstandingReportPayload,
} from "@/domain/reporting/types";
import {
  PrismaOutstandingReportStore,
  type OutstandingReportSourceFilters,
} from "@/server/reporting/outstanding-report-repository";

export type OutstandingReportServiceResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 401 | 403 | 503; error: string };

export interface OutstandingReportServiceDependencies {
  readonly store: Pick<
    PrismaOutstandingReportStore,
    "listOutstandingReportPage" | "listCompanyIdsInReportingGroup"
  >;
}

export function createDefaultOutstandingReportServiceDependencies(): OutstandingReportServiceDependencies {
  return {
    store: new PrismaOutstandingReportStore(),
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
 * Outstanding Report for authorized actors (TASK-080 / §13.3).
 * Requires report.view.
 * Admin: all companies; Compliance: assigned companies; Staff: assigned companies + own/assigned invoices.
 * Cancelled excluded by default (BR-019). Stored outstanding only (BR-009).
 * Does not invent reporting-currency equivalents or unlabeled mixed totals (BR-013 / ADR-011 OPEN).
 */
export async function getOutstandingReport(
  actor: AuthorizationPrincipal | null,
  query: unknown = {},
  deps: OutstandingReportServiceDependencies = createDefaultOutstandingReportServiceDependencies(),
): Promise<OutstandingReportServiceResult<OutstandingReportPayload>> {
  try {
    assertPermission(actor, "report.view");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsed = outstandingReportQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      return { ok: false, status: 400, error: OUTSTANDING_REPORT_INVALID_INPUT };
    }

    const resolved = resolveOutstandingReportQuery(parsed.data);

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

    const sourceFilters: OutstandingReportSourceFilters = {
      customerId: resolved.customerId,
      staffUserId: resolved.staffUserId,
      dateFrom: resolved.dateFrom,
      dateTo: resolved.dateTo,
      invoiceStatus: resolved.invoiceStatus,
      invoiceCurrency: resolved.invoiceCurrency,
      countryCode: resolved.countryCode,
      complianceStatus: resolved.complianceStatus,
      companyIds,
      visibleToStaffUserId,
      page: resolved.page,
      pageSize: resolved.pageSize,
      sortBy: resolved.sortBy,
      sortDir: resolved.sortDir,
    };

    const page = await deps.store.listOutstandingReportPage(sourceFilters);
    assertOutstandingReportUsesStoredBalance(page.rows);

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
      return { ok: false, status: 403, error: OUTSTANDING_REPORT_FORBIDDEN };
    }
    logger.error(
      {
        event: "outstanding_report.failed",
        err: error instanceof Error ? error.message : "unknown",
      },
      "Outstanding report load failed",
    );
    return { ok: false, status: 503, error: OUTSTANDING_REPORT_UNAVAILABLE };
  }
}
