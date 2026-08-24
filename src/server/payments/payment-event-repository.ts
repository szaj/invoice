import "server-only";

import { toDecimalString } from "@/domain/money";
import type {
  PaymentEventProcessingStatus,
  PaymentEventRecord,
} from "@/domain/payments/events/types";
import type { PaymentStatus } from "@/domain/payments/types";
import type { PaymentMethodCode } from "@/domain/settlement/types";
import { getPrisma } from "@/server/db/client";

type PaymentEventRow = {
  id: string;
  companyId: string;
  methodCode: PaymentMethodCode;
  paymentId: string | null;
  externalEventId: string;
  externalTransactionId: string | null;
  normalizedStatus: PaymentStatus | null;
  processorFeeAmount: { toString(): string } | null;
  processingStatus: PaymentEventProcessingStatus;
  correlationId: string;
  errorMessage: string | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function mapRow(row: PaymentEventRow): PaymentEventRecord {
  return {
    id: row.id,
    companyId: row.companyId,
    methodCode: row.methodCode,
    paymentId: row.paymentId,
    externalEventId: row.externalEventId,
    externalTransactionId: row.externalTransactionId,
    normalizedStatus: row.normalizedStatus,
    processorFeeAmount:
      row.processorFeeAmount != null ? toDecimalString(row.processorFeeAmount.toString()) : null,
    processingStatus: row.processingStatus,
    correlationId: row.correlationId,
    errorMessage: row.errorMessage,
    processedAt: row.processedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type PaymentEventCreateInput = {
  readonly companyId: string;
  readonly methodCode: PaymentMethodCode;
  readonly paymentId?: string | null;
  readonly externalEventId: string;
  readonly externalTransactionId?: string | null;
  readonly normalizedStatus?: PaymentStatus | null;
  readonly processorFeeAmount?: string | null;
  readonly processingStatus?: PaymentEventProcessingStatus;
  readonly correlationId: string;
  readonly errorMessage?: string | null;
  readonly processedAt?: Date | null;
};

/**
 * Persistence for gateway webhook events (TASK-053).
 * Unique (methodCode, externalEventId) enforces idempotency.
 */
export class PrismaPaymentEventStore {
  async findByExternalEventId(
    methodCode: PaymentMethodCode,
    externalEventId: string,
  ): Promise<PaymentEventRecord | null> {
    const prisma = getPrisma();
    const row = await prisma.paymentEvent.findUnique({
      where: {
        methodCode_externalEventId: { methodCode, externalEventId },
      },
    });
    return row ? mapRow(row as PaymentEventRow) : null;
  }

  /**
   * Inserts a new event. Returns null when the unique external event already exists.
   */
  async tryCreate(input: PaymentEventCreateInput): Promise<PaymentEventRecord | null> {
    const prisma = getPrisma();
    try {
      const row = await prisma.paymentEvent.create({
        data: {
          companyId: input.companyId,
          methodCode: input.methodCode,
          paymentId: input.paymentId ?? null,
          externalEventId: input.externalEventId,
          externalTransactionId: input.externalTransactionId ?? null,
          normalizedStatus: input.normalizedStatus ?? null,
          processorFeeAmount: input.processorFeeAmount ?? null,
          processingStatus: input.processingStatus ?? "RECEIVED",
          correlationId: input.correlationId,
          errorMessage: input.errorMessage ?? null,
          processedAt: input.processedAt ?? null,
        },
      });
      return mapRow(row as PaymentEventRow);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2002"
      ) {
        return null;
      }
      throw error;
    }
  }

  async update(
    id: string,
    patch: {
      readonly paymentId?: string | null;
      readonly processingStatus?: PaymentEventProcessingStatus;
      readonly errorMessage?: string | null;
      readonly processedAt?: Date | null;
    },
  ): Promise<PaymentEventRecord | null> {
    const prisma = getPrisma();
    const row = await prisma.paymentEvent.update({
      where: { id },
      data: {
        ...(patch.paymentId !== undefined ? { paymentId: patch.paymentId } : {}),
        ...(patch.processingStatus !== undefined
          ? { processingStatus: patch.processingStatus }
          : {}),
        ...(patch.errorMessage !== undefined ? { errorMessage: patch.errorMessage } : {}),
        ...(patch.processedAt !== undefined ? { processedAt: patch.processedAt } : {}),
      },
    });
    return mapRow(row as PaymentEventRow);
  }
}
