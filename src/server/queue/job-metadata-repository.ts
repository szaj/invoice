import type { BackgroundJobStatus, BackgroundJobRecord } from "@/domain/queue/types";
import { DEFAULT_QUEUE_ATTEMPTS } from "@/server/queue/config";
import { getPrisma } from "@/server/db/client";

export interface CreateBackgroundJobInput {
  readonly queueName: string;
  readonly jobName: string;
  readonly idempotencyKey?: string | null;
  readonly correlationId?: string | null;
  readonly companyId?: string | null;
  readonly entityType?: string | null;
  readonly entityId?: string | null;
  readonly maxAttempts?: number;
}

function toRecord(row: {
  id: string;
  queueName: string;
  jobName: string;
  bullJobId: string | null;
  idempotencyKey: string | null;
  correlationId: string | null;
  status: BackgroundJobStatus;
  attemptCount: number;
  maxAttempts: number;
  lastError: string | null;
  companyId: string | null;
  entityType: string | null;
  entityId: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}): BackgroundJobRecord {
  return {
    id: row.id,
    queueName: row.queueName,
    jobName: row.jobName,
    bullJobId: row.bullJobId,
    idempotencyKey: row.idempotencyKey,
    correlationId: row.correlationId,
    status: row.status,
    attemptCount: row.attemptCount,
    maxAttempts: row.maxAttempts,
    lastError: row.lastError,
    companyId: row.companyId,
    entityType: row.entityType,
    entityId: row.entityId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt,
  };
}

export class PrismaBackgroundJobStore {
  async createQueued(input: CreateBackgroundJobInput): Promise<BackgroundJobRecord> {
    const prisma = getPrisma();
    const row = await prisma.backgroundJob.create({
      data: {
        queueName: input.queueName,
        jobName: input.jobName,
        idempotencyKey: input.idempotencyKey ?? null,
        correlationId: input.correlationId ?? null,
        companyId: input.companyId ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        maxAttempts: input.maxAttempts ?? DEFAULT_QUEUE_ATTEMPTS,
        status: "QUEUED",
      },
    });
    return toRecord(row);
  }

  async attachBullJobId(id: string, bullJobId: string | null): Promise<void> {
    const prisma = getPrisma();
    await prisma.backgroundJob.update({
      where: { id },
      data: { bullJobId },
    });
  }

  async findByIdempotencyKey(
    queueName: string,
    idempotencyKey: string,
  ): Promise<BackgroundJobRecord | null> {
    const prisma = getPrisma();
    const row = await prisma.backgroundJob.findUnique({
      where: {
        queueName_idempotencyKey: {
          queueName,
          idempotencyKey,
        },
      },
    });
    return row ? toRecord(row) : null;
  }

  async findByBullJobId(bullJobId: string): Promise<BackgroundJobRecord | null> {
    const prisma = getPrisma();
    const row = await prisma.backgroundJob.findFirst({
      where: { bullJobId },
    });
    return row ? toRecord(row) : null;
  }

  async markActive(bullJobId: string, attemptNumber: number): Promise<void> {
    const prisma = getPrisma();
    await prisma.backgroundJob.updateMany({
      where: { bullJobId },
      data: {
        status: "ACTIVE",
        attemptCount: attemptNumber,
      },
    });
  }

  async markCompleted(
    bullJobId: string,
    status: Extract<BackgroundJobStatus, "COMPLETED" | "DUPLICATE_SKIPPED"> = "COMPLETED",
  ): Promise<void> {
    const prisma = getPrisma();
    await prisma.backgroundJob.updateMany({
      where: { bullJobId },
      data: {
        status,
        completedAt: new Date(),
        lastError: null,
      },
    });
  }

  async markFailed(bullJobId: string, message: string, exhausted: boolean): Promise<void> {
    const prisma = getPrisma();
    await prisma.backgroundJob.updateMany({
      where: { bullJobId },
      data: {
        status: exhausted ? "FAILED" : "ACTIVE",
        lastError: message.slice(0, 2_000),
        completedAt: exhausted ? new Date() : null,
      },
    });
  }
}
