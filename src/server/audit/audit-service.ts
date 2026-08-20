import "server-only";

import { randomUUID } from "node:crypto";

import { logger } from "@/lib/logger";
import { maskSensitiveAuditValues } from "@/domain/audit/mask";
import { appendAuditEventSchema } from "@/domain/audit/schema";
import {
  AUDIT_APPEND_ONLY_MESSAGE,
  AUDIT_WRITE_UNAVAILABLE,
  type AuditEventInput,
  type AuditEventRecord,
} from "@/domain/audit/types";
import { PrismaAuditEventStore, type AuditEventStore } from "@/server/audit/audit-repository";

export interface AuditWriter {
  append(input: AuditEventInput): Promise<AuditEventRecord>;
}

export interface AuditServiceDependencies {
  readonly store: AuditEventStore;
}

export function createDefaultAuditDependencies(): AuditServiceDependencies {
  return {
    store: new PrismaAuditEventStore(),
  };
}

export class AppendOnlyAuditWriter implements AuditWriter {
  constructor(private readonly deps: AuditServiceDependencies = createDefaultAuditDependencies()) {}

  async append(input: AuditEventInput): Promise<AuditEventRecord> {
    const parsed = appendAuditEventSchema.safeParse(input);
    if (!parsed.success) {
      logger.error({ event: "audit.invalid_input" }, "Invalid audit event rejected");
      throw new Error(AUDIT_WRITE_UNAVAILABLE);
    }

    const data = parsed.data;
    const correlationId = data.correlationId ?? randomUUID();
    const occurredAt = data.occurredAt ?? new Date();

    try {
      return await this.deps.store.append({
        actorType: data.actorType,
        actorUserId: data.actorUserId ?? null,
        companyId: data.companyId ?? null,
        entityType: data.entityType,
        entityId: data.entityId ?? null,
        action: data.action,
        oldValues:
          data.oldValues === undefined ? undefined : maskSensitiveAuditValues(data.oldValues),
        newValues:
          data.newValues === undefined ? undefined : maskSensitiveAuditValues(data.newValues),
        reason: data.reason ?? null,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
        correlationId,
        occurredAt,
      });
    } catch (error) {
      logger.error(
        {
          event: "audit.write_failed",
          action: data.action,
          err: error instanceof Error ? error.message : "unknown",
        },
        "Audit event write failed",
      );
      throw new Error(AUDIT_WRITE_UNAVAILABLE);
    }
  }

  /** Application APIs must not update audit rows. */
  update(): never {
    throw new Error(AUDIT_APPEND_ONLY_MESSAGE);
  }

  /** Application APIs must not delete audit rows. */
  delete(): never {
    throw new Error(AUDIT_APPEND_ONLY_MESSAGE);
  }
}

let defaultWriter: AppendOnlyAuditWriter | undefined;

export function getAuditWriter(): AuditWriter {
  defaultWriter ??= new AppendOnlyAuditWriter();
  return defaultWriter;
}

/**
 * Best-effort write for auth flows: never block login/logout on audit failure.
 */
export async function recordAuditEventBestEffort(
  input: AuditEventInput,
  writer: AuditWriter = getAuditWriter(),
): Promise<void> {
  try {
    await writer.append(input);
  } catch (error) {
    logger.error(
      {
        event: "audit.best_effort_failed",
        action: input.action,
        err: error instanceof Error ? error.message : "unknown",
      },
      "Best-effort audit write failed",
    );
  }
}

/**
 * Privileged admin/status mutations require a successful audit write (BR-015).
 */
export async function recordAuditEventRequired(
  input: AuditEventInput,
  writer: AuditWriter = getAuditWriter(),
): Promise<AuditEventRecord> {
  return writer.append(input);
}
