import "server-only";

import { logger } from "@/lib/logger";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import {
  assertCompanyAccess,
  assignedCompanyIdsOf,
  companyScopeForRole,
} from "@/domain/authz/company-access";
import { AuthorizationError } from "@/domain/authz/errors";
import { buildOverdueAgingReport } from "@/domain/reporting/overdue-aging";
import { overdueAgingQuerySchema } from "@/domain/reporting/schema";
import {
  OVERDUE_AGING_FORBIDDEN,
  OVERDUE_AGING_INVALID_INPUT,
  OVERDUE_AGING_UNAVAILABLE,
  type OverdueAgingPayload,
} from "@/domain/reporting/types";
import { nowUtc } from "@/lib/time";
import {
  PrismaOverdueAgingStore,
  type OverdueAgingSourceFilters,
} from "@/server/reporting/overdue-aging-repository";

export type OverdueAgingServiceResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 401 | 403 | 503; error: string };

export interface OverdueAgingServiceDependencies {
  readonly store: Pick<
    PrismaOverdueAgingStore,
    "listOverdueAgingInvoices" | "listCompanyIdsInReportingGroup"
  >;
  readonly now?: () => Date;
}

export function createDefaultOverdueAgingServiceDependencies(): OverdueAgingServiceDependencies {
  return {
    store: new PrismaOverdueAgingStore(),
    now: nowUtc,
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
 * Overdue Aging Report for authorized actors (TASK-081 / §13.3).
 * Requires report.view.
 * Admin: all companies; Compliance: assigned companies; Staff: assigned companies + own/assigned invoices.
 * BR-018 overdue only (past due, open balance, issued/partial/overdue). Draft never aged.
 * Does not invent reporting-currency equivalents or unlabeled mixed totals (BR-013 / ADR-011 OPEN).
 */
export async function getOverdueAgingReport(
  actor: AuthorizationPrincipal | null,
  query: unknown = {},
  deps: OverdueAgingServiceDependencies = createDefaultOverdueAgingServiceDependencies(),
): Promise<OverdueAgingServiceResult<OverdueAgingPayload>> {
  try {
    assertPermission(actor, "report.view");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsed = overdueAgingQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      return { ok: false, status: 400, error: OVERDUE_AGING_INVALID_INPUT };
    }

    const resolved = parsed.data;

    let companyIds = resolveReportCompanyScope(actor, resolved.companyId);
    if (resolved.reportingGroupId) {
      const groupCompanyIds = await deps.store.listCompanyIdsInReportingGroup(
        resolved.reportingGroupId,
      );
      companyIds = intersectCompanyIds(companyIds, groupCompanyIds);
    }

    const asOf = deps.now?.() ?? nowUtc();

    if (companyIds !== "ALL" && companyIds.length === 0) {
      return { ok: true, data: buildOverdueAgingReport([], asOf) };
    }

    const visibleToStaffUserId = actor.roleCode === "STAFF" ? actor.userId : null;

    const sourceFilters: OverdueAgingSourceFilters = {
      customerId: resolved.customerId,
      staffUserId: resolved.staffUserId,
      invoiceCurrency: resolved.invoiceCurrency,
      countryCode: resolved.countryCode,
      complianceStatus: resolved.complianceStatus,
      companyIds,
      visibleToStaffUserId,
      asOf,
    };

    const invoices = await deps.store.listOverdueAgingInvoices(sourceFilters);
    return { ok: true, data: buildOverdueAgingReport(invoices, asOf) };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, status: 403, error: OVERDUE_AGING_FORBIDDEN };
    }
    logger.error(
      {
        event: "overdue_aging.failed",
        err: error instanceof Error ? error.message : "unknown",
      },
      "Overdue aging report load failed",
    );
    return { ok: false, status: 503, error: OVERDUE_AGING_UNAVAILABLE };
  }
}
