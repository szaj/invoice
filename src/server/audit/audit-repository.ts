import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { AuditEventInput, AuditEventRecord, AuditJson } from "@/domain/audit/types";
import { getPrisma } from "@/server/db/client";

function toAuditJson(value: Prisma.JsonValue | null | undefined): AuditJson {
  if (value === null || value === undefined) {
    return null;
  }
  return value as AuditJson;
}

function mapRow(row: {
  id: string;
  occurredAt: Date;
  actorType: "USER" | "SYSTEM" | "WEBHOOK";
  actorUserId: string | null;
  companyId: string | null;
  entityType: string;
  entityId: string | null;
  action: string;
  oldValues: Prisma.JsonValue | null;
  newValues: Prisma.JsonValue | null;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string | null;
}): AuditEventRecord {
  return {
    id: row.id,
    occurredAt: row.occurredAt,
    actorType: row.actorType,
    actorUserId: row.actorUserId,
    companyId: row.companyId,
    entityType: row.entityType,
    entityId: row.entityId,
    action: row.action,
    oldValues: toAuditJson(row.oldValues),
    newValues: toAuditJson(row.newValues),
    reason: row.reason,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    correlationId: row.correlationId,
  };
}

export interface AuditEventStore {
  append(
    input: AuditEventInput & { correlationId: string; occurredAt: Date },
  ): Promise<AuditEventRecord>;
}

/**
 * Write-only Prisma store. Update/delete are intentionally absent.
 */
export class PrismaAuditEventStore implements AuditEventStore {
  async append(
    input: AuditEventInput & { correlationId: string; occurredAt: Date },
  ): Promise<AuditEventRecord> {
    const prisma = getPrisma();
    const created = await prisma.auditLog.create({
      data: {
        occurredAt: input.occurredAt,
        actorType: input.actorType,
        actorUserId: input.actorUserId ?? null,
        companyId: input.companyId ?? null,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        action: input.action,
        oldValues:
          input.oldValues === undefined || input.oldValues === null
            ? undefined
            : (input.oldValues as Prisma.InputJsonValue),
        newValues:
          input.newValues === undefined || input.newValues === null
            ? undefined
            : (input.newValues as Prisma.InputJsonValue),
        reason: input.reason ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        correlationId: input.correlationId,
      },
    });

    return mapRow(created);
  }
}
