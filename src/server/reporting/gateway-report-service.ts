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
  assertGatewayReportFeesSeparateFromSettlement,
  assertGatewayReportHasNoUnlabeledMixedTotal,
  buildGatewayReportRows,
  paginateGatewayReportRows,
  sortGatewayReportRows,
} from "@/domain/reporting/gateway-report";
import { gatewayReportQuerySchema, resolveGatewayReportQuery } from "@/domain/reporting/schema";
import {
  GATEWAY_REPORT_FORBIDDEN,
  GATEWAY_REPORT_INVALID_INPUT,
  GATEWAY_REPORT_UNAVAILABLE,
  type GatewayReportPayload,
} from "@/domain/reporting/types";
import {
  PrismaGatewayReportStore,
  type GatewayReportSourceFilters,
} from "@/server/reporting/gateway-report-repository";

export type GatewayReportServiceResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 401 | 403 | 503; error: string };

export interface GatewayReportServiceDependencies {
  readonly store: Pick<
    PrismaGatewayReportStore,
    "listPaymentRows" | "listRefundRows" | "listCompanyIdsInReportingGroup"
  >;
}

export function createDefaultGatewayReportServiceDependencies(): GatewayReportServiceDependencies {
  return {
    store: new PrismaGatewayReportStore(),
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
 * Gateway Report for authorized actors (TASK-085 / §13.3).
 * Requires report.view.
 * Admin: all companies; Compliance: assigned; Staff: assigned + own/assigned invoices.
 * Totals by gateway × settlement currency; fees never deducted from converted settlement (BR-020).
 * Does not invent reporting-currency equivalents or unlabeled mixed totals (ADR-011 OPEN).
 */
export async function getGatewayReport(
  actor: AuthorizationPrincipal | null,
  query: unknown = {},
  deps: GatewayReportServiceDependencies = createDefaultGatewayReportServiceDependencies(),
): Promise<GatewayReportServiceResult<GatewayReportPayload>> {
  try {
    assertPermission(actor, "report.view");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsed = gatewayReportQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      return { ok: false, status: 400, error: GATEWAY_REPORT_INVALID_INPUT };
    }

    const resolved = resolveGatewayReportQuery(parsed.data);

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

    const sourceFilters: GatewayReportSourceFilters = {
      ...resolved,
      companyIds,
      visibleToStaffUserId,
    };

    const [payments, refunds] = await Promise.all([
      deps.store.listPaymentRows(sourceFilters),
      deps.store.listRefundRows(sourceFilters),
    ]);

    const aggregated = buildGatewayReportRows(payments, refunds);
    assertGatewayReportHasNoUnlabeledMixedTotal(aggregated);
    assertGatewayReportFeesSeparateFromSettlement(aggregated, payments);

    const sorted = sortGatewayReportRows(aggregated, resolved.sortBy, resolved.sortDir);
    const page = paginateGatewayReportRows(sorted, resolved.page, resolved.pageSize);

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
      return { ok: false, status: 403, error: GATEWAY_REPORT_FORBIDDEN };
    }
    logger.error(
      {
        event: "gateway_report.failed",
        err: error instanceof Error ? error.message : "unknown",
      },
      "Gateway report load failed",
    );
    return { ok: false, status: 503, error: GATEWAY_REPORT_UNAVAILABLE };
  }
}
