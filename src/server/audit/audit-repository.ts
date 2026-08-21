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
 * Entity-scoped reads for customer profile activity (TASK-026) are allowed.
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

  /**
   * List events for one entity. Callers must enforce authorization and company scope.
   * When `allowedCompanyIds` is set, only events with null companyId or a listed companyId are returned.
   */
  async listByEntity(input: {
    readonly entityType: string;
    readonly entityId: string;
    readonly allowedCompanyIds?: readonly string[] | null;
    readonly companyId?: string | null;
    readonly limit?: number;
  }): Promise<AuditEventRecord[]> {
    const prisma = getPrisma();
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);

    const companyFilter: Prisma.AuditLogWhereInput[] = [];
    if (input.companyId) {
      companyFilter.push({
        OR: [{ companyId: null }, { companyId: input.companyId }],
      });
    }
    if (input.allowedCompanyIds) {
      companyFilter.push({
        OR: [{ companyId: null }, { companyId: { in: [...input.allowedCompanyIds] } }],
      });
    }

    const rows = await prisma.auditLog.findMany({
      where: {
        entityType: input.entityType,
        entityId: input.entityId,
        AND: companyFilter.length > 0 ? companyFilter : undefined,
      },
      orderBy: { occurredAt: "desc" },
      take: limit,
    });

    return rows.map(mapRow);
  }
}
