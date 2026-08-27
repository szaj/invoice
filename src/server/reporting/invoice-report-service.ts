import "server-only";

import { logger } from "@/lib/logger";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import {
  assertCompanyAccess,
  assignedCompanyIdsOf,
  companyScopeForRole,
} from "@/domain/authz/company-access";
import { AuthorizationError } from "@/domain/authz/errors";
import { invoiceReportQuerySchema, resolveInvoiceReportQuery } from "@/domain/reporting/schema";
import {
  INVOICE_REPORT_FORBIDDEN,
  INVOICE_REPORT_INVALID_INPUT,
  INVOICE_REPORT_UNAVAILABLE,
  type InvoiceReportPayload,
} from "@/domain/reporting/types";
import {
  PrismaInvoiceReportStore,
  type InvoiceReportSourceFilters,
} from "@/server/reporting/invoice-report-repository";

export type InvoiceReportServiceResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 401 | 403 | 503; error: string };

export interface InvoiceReportServiceDependencies {
  readonly store: Pick<
    PrismaInvoiceReportStore,
    "listInvoiceReportPage" | "listCompanyIdsInReportingGroup"
  >;
}

export function createDefaultInvoiceReportServiceDependencies(): InvoiceReportServiceDependencies {
  return {
    store: new PrismaInvoiceReportStore(),
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
 * Invoice Report for authorized actors (TASK-078 / §13.3).
 * Requires report.view.
 * Admin: all companies; Compliance: assigned companies; Staff: assigned companies + own/assigned invoices.
 * Does not invent reporting-currency equivalents or unlabeled mixed totals (BR-013 / ADR-011 OPEN).
 */
export async function getInvoiceReport(
  actor: AuthorizationPrincipal | null,
  query: unknown = {},
  deps: InvoiceReportServiceDependencies = createDefaultInvoiceReportServiceDependencies(),
): Promise<InvoiceReportServiceResult<InvoiceReportPayload>> {
  try {
    assertPermission(actor, "report.view");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsed = invoiceReportQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      return { ok: false, status: 400, error: INVOICE_REPORT_INVALID_INPUT };
    }

    const resolved = resolveInvoiceReportQuery(parsed.data);

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

    const sourceFilters: InvoiceReportSourceFilters = {
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

    const page = await deps.store.listInvoiceReportPage(sourceFilters);

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
      return { ok: false, status: 403, error: INVOICE_REPORT_FORBIDDEN };
    }
    logger.error(
      {
        event: "invoice_report.failed",
        err: error instanceof Error ? error.message : "unknown",
      },
      "Invoice report load failed",
    );
    return { ok: false, status: 503, error: INVOICE_REPORT_UNAVAILABLE };
  }
}
