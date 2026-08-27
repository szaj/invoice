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
  assertCustomerReportHasNoUnlabeledMixedTotal,
  buildCustomerReportRows,
  paginateCustomerReportRows,
  sortCustomerReportRows,
} from "@/domain/reporting/customer-report";
import { customerReportQuerySchema, resolveCustomerReportQuery } from "@/domain/reporting/schema";
import {
  CUSTOMER_REPORT_FORBIDDEN,
  CUSTOMER_REPORT_INVALID_INPUT,
  CUSTOMER_REPORT_UNAVAILABLE,
  type CustomerReportPayload,
} from "@/domain/reporting/types";
import {
  PrismaCustomerReportStore,
  type CustomerReportSourceFilters,
} from "@/server/reporting/customer-report-repository";

export type CustomerReportServiceResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 401 | 403 | 503; error: string };

export interface CustomerReportServiceDependencies {
  readonly store: Pick<
    PrismaCustomerReportStore,
    "listCustomerReportInvoices" | "listCompanyIdsInReportingGroup"
  >;
}

export function createDefaultCustomerReportServiceDependencies(): CustomerReportServiceDependencies {
  return {
    store: new PrismaCustomerReportStore(),
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
 * Customer Report for authorized actors (TASK-082 / §13.3).
 * Requires report.view.
 * Admin: all companies; Compliance: assigned companies; Staff: assigned companies + own/assigned invoices.
 * Totals by customer × invoice currency only (BR-013). Stored balances (BR-009).
 * Does not invent reporting-currency equivalents or unlabeled mixed totals (ADR-011 OPEN).
 */
export async function getCustomerReport(
  actor: AuthorizationPrincipal | null,
  query: unknown = {},
  deps: CustomerReportServiceDependencies = createDefaultCustomerReportServiceDependencies(),
): Promise<CustomerReportServiceResult<CustomerReportPayload>> {
  try {
    assertPermission(actor, "report.view");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsed = customerReportQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      return { ok: false, status: 400, error: CUSTOMER_REPORT_INVALID_INPUT };
    }

    const resolved = resolveCustomerReportQuery(parsed.data);

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

    const sourceFilters: CustomerReportSourceFilters = {
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
    };

    const invoices = await deps.store.listCustomerReportInvoices(sourceFilters);
    const aggregated = buildCustomerReportRows(invoices);
    assertCustomerReportHasNoUnlabeledMixedTotal(aggregated);
    const sorted = sortCustomerReportRows(aggregated, resolved.sortBy, resolved.sortDir);
    const page = paginateCustomerReportRows(sorted, resolved.page, resolved.pageSize);

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
      return { ok: false, status: 403, error: CUSTOMER_REPORT_FORBIDDEN };
    }
    logger.error(
      {
        event: "customer_report.failed",
        err: error instanceof Error ? error.message : "unknown",
      },
      "Customer report load failed",
    );
    return { ok: false, status: 503, error: CUSTOMER_REPORT_UNAVAILABLE };
  }
}
