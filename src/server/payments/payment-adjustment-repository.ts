import "server-only";

import type {
  PaymentAdjustmentRecord,
  PaymentAdjustmentStatus,
  PaymentAdjustmentType,
} from "@/domain/payments/adjustments";
import { toDecimalString } from "@/domain/money";
import { getPrisma } from "@/server/db/client";

type AdjustmentRow = {
  id: string;
  companyId: string;
  paymentId: string;
  type: PaymentAdjustmentType;
  status: PaymentAdjustmentStatus;
  amount: { toString(): string };
  invoiceAmount: { toString(): string } | null;
  settlementAmount: { toString(): string } | null;
  reason: string | null;
  merchantReference: string | null;
  notes: string | null;
  effectiveDate: Date;
  openedAt: Date | null;
  processedAt: Date | null;
  resolvedAt: Date | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function mapRow(row: AdjustmentRow): PaymentAdjustmentRecord {
  return {
    id: row.id,
    companyId: row.companyId,
    paymentId: row.paymentId,
    type: row.type,
    status: row.status,
    amount: toDecimalString(row.amount.toString()),
    invoiceAmount: row.invoiceAmount != null ? toDecimalString(row.invoiceAmount.toString()) : null,
    settlementAmount:
      row.settlementAmount != null ? toDecimalString(row.settlementAmount.toString()) : null,
    reason: row.reason,
    merchantReference: row.merchantReference,
    notes: row.notes,
    effectiveDate: row.effectiveDate,
    openedAt: row.openedAt,
    processedAt: row.processedAt,
    resolvedAt: row.resolvedAt,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type PaymentAdjustmentCreateInput = {
  readonly companyId: string;
  readonly paymentId: string;
  readonly type: PaymentAdjustmentType;
  readonly status: PaymentAdjustmentStatus;
  readonly amount: string;
  readonly invoiceAmount: string | null;
  readonly settlementAmount: string | null;
  readonly reason: string | null;
  readonly merchantReference: string | null;
  readonly notes: string | null;
  readonly effectiveDate: Date;
  readonly openedAt: Date | null;
  readonly processedAt: Date | null;
  readonly resolvedAt: Date | null;
  readonly createdByUserId: string | null;
};

/**
 * Persistence for linked payment adjustments (TASK-063 / TASK-068).
 * Does not update the original payment row. Cancel is status-only — never hard-delete.
 */
export class PrismaPaymentAdjustmentStore {
  async createAdjustment(input: PaymentAdjustmentCreateInput): Promise<PaymentAdjustmentRecord> {
    const prisma = getPrisma();
    const row = await prisma.paymentAdjustment.create({
      data: {
        companyId: input.companyId,
        paymentId: input.paymentId,
        type: input.type,
        status: input.status,
        amount: input.amount,
        invoiceAmount: input.invoiceAmount,
        settlementAmount: input.settlementAmount,
        reason: input.reason,
        merchantReference: input.merchantReference,
        notes: input.notes,
        effectiveDate: input.effectiveDate,
        openedAt: input.openedAt,
        processedAt: input.processedAt,
        resolvedAt: input.resolvedAt,
        createdByUserId: input.createdByUserId,
      },
    });
    return mapRow(row as AdjustmentRow);
  }

  async getAdjustmentById(adjustmentId: string): Promise<PaymentAdjustmentRecord | null> {
    const prisma = getPrisma();
    const row = await prisma.paymentAdjustment.findUnique({
      where: { id: adjustmentId },
    });
    return row ? mapRow(row as AdjustmentRow) : null;
  }

  async listAdjustmentsByPayment(paymentId: string): Promise<PaymentAdjustmentRecord[]> {
    const prisma = getPrisma();
    const rows = await prisma.paymentAdjustment.findMany({
      where: { paymentId },
      orderBy: [{ createdAt: "asc" }],
    });
    return rows.map((row) => mapRow(row as AdjustmentRow));
  }

  /**
   * Soft-cancel: set status CANCELLED and resolvedAt. Retains the row for audit (TASK-068).
   * Never hard-deletes adjustment history.
   */
  async cancelAdjustment(input: {
    readonly adjustmentId: string;
    readonly resolvedAt: Date;
  }): Promise<PaymentAdjustmentRecord> {
    const prisma = getPrisma();
    const row = await prisma.paymentAdjustment.update({
      where: { id: input.adjustmentId },
      data: {
        status: "CANCELLED",
        resolvedAt: input.resolvedAt,
      },
    });
    return mapRow(row as AdjustmentRow);
  }
}
