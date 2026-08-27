import "server-only";

import { logger } from "@/lib/logger";
import { maskSensitiveAuditValues } from "@/domain/audit/mask";
import { auditViewerQuerySchema } from "@/domain/audit/schema";
import {
  AUDIT_INVALID_INPUT,
  AUDIT_READ_FORBIDDEN,
  AUDIT_UNAVAILABLE,
  AUDIT_VIEWER_DEFAULT_LIMIT,
  type AuditEventRecord,
  type AuditJson,
  type AuditViewerEvent,
} from "@/domain/audit/types";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import {
  assertCompanyAccess,
  assignedCompanyIdsOf,
  companyScopeForRole,
} from "@/domain/authz/company-access";
import { AuthorizationError } from "@/domain/authz/errors";
import { PrismaAuditEventStore } from "@/server/audit/audit-repository";

export type AuditQueryResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 401 | 403 | 503; error: string };

export interface AuditQueryStore {
  list(input: Parameters<PrismaAuditEventStore["list"]>[0]): Promise<AuditEventRecord[]>;
}

export interface AuditQueryServiceDependencies {
  readonly store: AuditQueryStore;
}

export function createDefaultAuditQueryDependencies(): AuditQueryServiceDependencies {
  return {
    store: new PrismaAuditEventStore(),
  };
}

function resolveAuditCompanyScope(
  actor: AuthorizationPrincipal,
  companyId: string | undefined,
): { companyIds: readonly string[] | "ALL"; includeNullCompany: boolean } {
  if (companyId) {
    assertCompanyAccess(actor, companyId);
    return { companyIds: [companyId], includeNullCompany: false };
  }
  if (companyScopeForRole(actor.roleCode) === "ALL") {
    return { companyIds: "ALL", includeNullCompany: true };
  }
  return { companyIds: [...assignedCompanyIdsOf(actor)], includeNullCompany: false };
}

function maskStoredValues(value: AuditJson): AuditJson {
  return maskSensitiveAuditValues(value);
}

function toViewerEvent(row: AuditEventRecord): AuditViewerEvent {
  return {
    id: row.id,
    occurredAt: row.occurredAt.toISOString(),
    actorType: row.actorType,
    actorUserId: row.actorUserId,
    companyId: row.companyId,
    entityType: row.entityType,
    entityId: row.entityId,
    action: row.action,
    oldValues: maskStoredValues(row.oldValues),
    newValues: maskStoredValues(row.newValues),
    reason: row.reason,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    correlationId: row.correlationId,
  };
}

/**
 * Read-only filtered audit viewer (TASK-076).
 * Requires audit.read. Admin sees all companies; Compliance is limited to assigned companies.
 * Staff is denied (US-010 — no invented grant). Values are re-masked before return.
 */
export async function listAuditEvents(
  actor: AuthorizationPrincipal | null,
  query: unknown = {},
  deps: AuditQueryServiceDependencies = createDefaultAuditQueryDependencies(),
): Promise<AuditQueryResult<AuditViewerEvent[]>> {
  try {
    assertPermission(actor, "audit.read");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsed = auditViewerQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      return { ok: false, status: 400, error: AUDIT_INVALID_INPUT };
    }

    const { companyIds, includeNullCompany } = resolveAuditCompanyScope(
      actor,
      parsed.data.companyId,
    );
    if (companyIds !== "ALL" && companyIds.length === 0) {
      return { ok: true, data: [] };
    }

    const rows = await deps.store.list({
      companyIds,
      includeNullCompany,
      actorUserId: parsed.data.actorUserId,
      actorType: parsed.data.actorType,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      action: parsed.data.action,
      dateFrom: parsed.data.dateFrom,
      dateTo: parsed.data.dateTo,
      limit: parsed.data.limit ?? AUDIT_VIEWER_DEFAULT_LIMIT,
    });

    return { ok: true, data: rows.map(toViewerEvent) };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, status: error.status, error: AUDIT_READ_FORBIDDEN };
    }
    logger.error(
      {
        event: "audit.viewer_list_failed",
        err: error instanceof Error ? error.message : "unknown",
      },
      "Audit viewer list failed",
    );
    return { ok: false, status: 503, error: AUDIT_UNAVAILABLE };
  }
}
