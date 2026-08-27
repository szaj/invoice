import "server-only";

import { logger } from "@/lib/logger";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import {
  assertCompanyAccess,
  assignedCompanyIdsOf,
  companyScopeForRole,
} from "@/domain/authz/company-access";
import { AuthorizationError } from "@/domain/authz/errors";
import { paymentReportRowsFromStoredSnapshots } from "@/domain/reporting/payment-report";
import { paymentReportQuerySchema, resolvePaymentReportQuery } from "@/domain/reporting/schema";
import {
  PAYMENT_REPORT_FORBIDDEN,
  PAYMENT_REPORT_INVALID_INPUT,
  PAYMENT_REPORT_UNAVAILABLE,
  type PaymentReportPayload,
} from "@/domain/reporting/types";
import {
  PrismaPaymentReportStore,
  type PaymentReportSourceFilters,
} from "@/server/reporting/payment-report-repository";

export type PaymentReportServiceResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 401 | 403 | 503; error: string };

export interface PaymentReportServiceDependencies {
  readonly store: Pick<
    PrismaPaymentReportStore,
    "listPaymentReportPage" | "listCompanyIdsInReportingGroup"
  >;
}

export function createDefaultPaymentReportServiceDependencies(): PaymentReportServiceDependencies {
  return {
    store: new PrismaPaymentReportStore(),
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
 * Payment Report for authorized actors (TASK-079 / §13.3).
 * Requires report.view.
 * Admin: all companies; Compliance: assigned companies; Staff: assigned companies + own/assigned invoices.
 * Uses stored fixed-rate snapshots and converted settlement only — never live FX (BR-020/021).
 * Optional fee and actual received remain separate reconciliation fields (BR-020).
 * Does not invent reporting-currency equivalents or unlabeled mixed totals (BR-013 / ADR-011 OPEN).
 */
export async function getPaymentReport(
  actor: AuthorizationPrincipal | null,
  query: unknown = {},
  deps: PaymentReportServiceDependencies = createDefaultPaymentReportServiceDependencies(),
): Promise<PaymentReportServiceResult<PaymentReportPayload>> {
  try {
    assertPermission(actor, "report.view");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsed = paymentReportQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      return { ok: false, status: 400, error: PAYMENT_REPORT_INVALID_INPUT };
    }

    const resolved = resolvePaymentReportQuery(parsed.data);

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

    const sourceFilters: PaymentReportSourceFilters = {
      customerId: resolved.customerId,
      staffUserId: resolved.staffUserId,
      dateFrom: resolved.dateFrom,
      dateTo: resolved.dateTo,
      paymentStatus: resolved.paymentStatus,
      paymentMethod: resolved.paymentMethod,
      invoiceCurrency: resolved.invoiceCurrency,
      settlementCurrency: resolved.settlementCurrency,
      countryCode: resolved.countryCode,
      complianceStatus: resolved.complianceStatus,
      companyIds,
      visibleToStaffUserId,
      page: resolved.page,
      pageSize: resolved.pageSize,
      sortBy: resolved.sortBy,
      sortDir: resolved.sortDir,
    };

    const page = await deps.store.listPaymentReportPage(sourceFilters);
    const rows = paymentReportRowsFromStoredSnapshots(page.rows);

    return {
      ok: true,
      data: {
        rows,
        page: resolved.page,
        pageSize: resolved.pageSize,
        totalCount: page.totalCount,
        sortBy: resolved.sortBy,
        sortDir: resolved.sortDir,
      },
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, status: 403, error: PAYMENT_REPORT_FORBIDDEN };
    }
    logger.error(
      {
        event: "payment_report.failed",
        err: error instanceof Error ? error.message : "unknown",
      },
      "Payment report load failed",
    );
    return { ok: false, status: 503, error: PAYMENT_REPORT_UNAVAILABLE };
  }
}
