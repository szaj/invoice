import type { AuditEventInput, AuditEventRecord } from "@/domain/audit/types";
import type { AuditWriter } from "@/server/audit/audit-service";

export function createMemoryAuditWriter(): AuditWriter & {
  events: AuditEventRecord[];
} {
  const events: AuditEventRecord[] = [];
  return {
    events,
    async append(input: AuditEventInput): Promise<AuditEventRecord> {
      const record: AuditEventRecord = {
        id: `audit-${events.length + 1}`,
        occurredAt: input.occurredAt ?? new Date("2026-08-20T12:00:00.000Z"),
        actorType: input.actorType,
        actorUserId: input.actorUserId ?? null,
        companyId: input.companyId ?? null,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        action: input.action,
        oldValues: input.oldValues ?? null,
        newValues: input.newValues ?? null,
        reason: input.reason ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        correlationId: input.correlationId ?? `corr-${events.length + 1}`,
      };
      events.push(record);
      return record;
    },
  };
}
