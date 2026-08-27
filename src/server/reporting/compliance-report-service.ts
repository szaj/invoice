import "server-only";

import { logger } from "@/lib/logger";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import {
  assertCompanyAccess,
  assignedCompanyIdsOf,
  companyScopeForRole,
} from "@/domain/authz/company-access";
import { AuthorizationError } from "@/domain/authz/errors";
import { buildComplianceReport } from "@/domain/reporting/compliance-report";
import { complianceReportQuerySchema } from "@/domain/reporting/schema";
import {
  COMPLIANCE_REPORT_FORBIDDEN,
  COMPLIANCE_REPORT_INVALID_INPUT,
  COMPLIANCE_REPORT_UNAVAILABLE,
  type ComplianceReportPayload,
} from "@/domain/reporting/types";
import {
  PrismaComplianceReportStore,
  type ComplianceReportSourceFilters,
} from "@/server/reporting/compliance-report-repository";

export type ComplianceReportServiceResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 401 | 403 | 503; error: string };

export interface ComplianceReportServiceDependencies {
  readonly store: Pick<
    PrismaComplianceReportStore,
    "listSubjects" | "listNoteReferences" | "listCompanyIdsInReportingGroup"
  >;
}

export function createDefaultComplianceReportServiceDependencies(): ComplianceReportServiceDependencies {
  return {
    store: new PrismaComplianceReportStore(),
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
 * Compliance Report for authorized actors (TASK-087 / §13.3).
 * Requires report.view and compliance.review (Admin/Compliance).
 * Staff is denied by default — report.view alone is not enough.
 * Read-only aggregation; does not manipulate audit logs.
 */
export async function getComplianceReport(
  actor: AuthorizationPrincipal | null,
  query: unknown = {},
  deps: ComplianceReportServiceDependencies = createDefaultComplianceReportServiceDependencies(),
): Promise<ComplianceReportServiceResult<ComplianceReportPayload>> {
  try {
    assertPermission(actor, "report.view");
    assertPermission(actor, "compliance.review");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsed = complianceReportQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      return { ok: false, status: 400, error: COMPLIANCE_REPORT_INVALID_INPUT };
    }

    let companyIds = resolveReportCompanyScope(actor, parsed.data.companyId);
    if (parsed.data.reportingGroupId) {
      const groupCompanyIds = await deps.store.listCompanyIdsInReportingGroup(
        parsed.data.reportingGroupId,
      );
      companyIds = intersectCompanyIds(companyIds, groupCompanyIds);
    }

    if (companyIds !== "ALL" && companyIds.length === 0) {
      return {
        ok: true,
        data: buildComplianceReport([], []),
      };
    }

    const sourceFilters: ComplianceReportSourceFilters = {
      ...parsed.data,
      companyIds,
    };

    const [subjects, notes] = await Promise.all([
      deps.store.listSubjects(sourceFilters),
      deps.store.listNoteReferences(sourceFilters),
    ]);

    return { ok: true, data: buildComplianceReport(subjects, notes) };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, status: 403, error: COMPLIANCE_REPORT_FORBIDDEN };
    }
    logger.error(
      {
        event: "compliance_report.failed",
        err: error instanceof Error ? error.message : "unknown",
      },
      "Compliance report load failed",
    );
    return { ok: false, status: 503, error: COMPLIANCE_REPORT_UNAVAILABLE };
  }
}
