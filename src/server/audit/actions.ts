import "server-only";

import { authorizePermission } from "@/domain/authz/authorize";
import { auditEntityHref } from "@/domain/audit/viewer";
import type { AuditViewerQuery } from "@/domain/audit/schema";
import { AUDIT_READ_FORBIDDEN, type AuditViewerEvent } from "@/domain/audit/types";
import { formatTimestampInTimeZone } from "@/lib/time";
import { listAuditEvents } from "@/server/audit/audit-query-service";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { listSwitcherCompanies } from "@/server/company-context/accessible-companies";
import { PrismaSystemSettingsStore } from "@/server/settings/settings-repository";

export type AuditLogRow = {
  readonly id: string;
  readonly occurredAtDisplay: string;
  readonly occurredAtIso: string;
  readonly actorType: AuditViewerEvent["actorType"];
  readonly actorUserId: string | null;
  readonly actorLabel: string;
  readonly companyId: string | null;
  readonly companyDisplayName: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly entityHref: string | null;
  readonly action: string;
  readonly reason: string | null;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly correlationId: string | null;
  readonly oldValuesJson: string | null;
  readonly newValuesJson: string | null;
};

function stringifyAuditJson(value: AuditViewerEvent["oldValues"]): string | null {
  if (value === null) {
    return null;
  }
  return JSON.stringify(value, null, 2);
}

function actorLabel(event: AuditViewerEvent): string {
  if (event.actorType !== "USER") {
    return event.actorType === "SYSTEM" ? "System" : "Webhook";
  }
  if (!event.actorUserId) {
    return "User";
  }
  return `User ${event.actorUserId.slice(0, 8)}`;
}

/**
 * Company options for the audit viewer filters (TASK-076).
 * Requires audit.read. Staff is denied (US-010).
 */
export async function loadAuditViewerOptions(companyId?: string | null) {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "audit.read").allowed) {
    return {
      ok: false as const,
      status: 403 as const,
      error: AUDIT_READ_FORBIDDEN,
      companies: [] as Array<{ id: string; displayName: string }>,
      defaultCompanyId: null as string | null,
      timeZone: "UTC",
    };
  }

  const [companies, settings] = await Promise.all([
    listSwitcherCompanies(actor),
    new PrismaSystemSettingsStore().getSettings(),
  ]);
  const selectedCompanyId =
    companyId && companies.some((company) => company.id === companyId) ? companyId : null;

  return {
    ok: true as const,
    companies: companies.map((company) => ({
      id: company.id,
      displayName: company.displayName,
    })),
    defaultCompanyId: selectedCompanyId,
    timeZone: settings?.defaultTimezone ?? "UTC",
  };
}

/**
 * Audit viewer rows for UI (TASK-076).
 * Delegates to listAuditEvents — Staff denied; unassigned companies excluded.
 */
export async function loadAuditEventsForUi(
  query: AuditViewerQuery,
  timeZone: string,
): Promise<
  | { ok: true; data: AuditLogRow[]; status?: undefined; error?: undefined }
  | { ok: false; error: string; status: number; data?: undefined }
> {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "audit.read").allowed) {
    return { ok: false, status: 403, error: AUDIT_READ_FORBIDDEN };
  }

  const result = await listAuditEvents(actor, query);
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error };
  }

  const companies = await listSwitcherCompanies(actor);
  const companyNameById = new Map(companies.map((company) => [company.id, company.displayName]));

  return {
    ok: true,
    data: result.data.map((event) => ({
      id: event.id,
      occurredAtDisplay: formatTimestampInTimeZone(new Date(event.occurredAt), timeZone),
      occurredAtIso: event.occurredAt,
      actorType: event.actorType,
      actorUserId: event.actorUserId,
      actorLabel: actorLabel(event),
      companyId: event.companyId,
      companyDisplayName: event.companyId
        ? (companyNameById.get(event.companyId) ?? event.companyId.slice(0, 8))
        : "—",
      entityType: event.entityType,
      entityId: event.entityId,
      entityHref: auditEntityHref(event.entityType, event.entityId),
      action: event.action,
      reason: event.reason,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      correlationId: event.correlationId,
      oldValuesJson: stringifyAuditJson(event.oldValues),
      newValuesJson: stringifyAuditJson(event.newValues),
    })),
  };
}
