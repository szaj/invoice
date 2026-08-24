import "server-only";

import type { PaymentWriteInput } from "@/domain/payments/schema";
import { assertPaymentHardDeleteAllowed } from "@/domain/payments/invariants";
import type {
  PaymentRateSource,
  PaymentRecord,
  PaymentSource,
  PaymentStatus,
} from "@/domain/payments/types";
import type { PaymentMethodCode } from "@/domain/settlement/types";
import { toDecimalString } from "@/domain/money";
import { getPrisma } from "@/server/db/client";

type PaymentRow = {
  id: string;
  companyId: string;
  invoiceId: string;
  customerId: string;
  methodCode: PaymentMethodCode;
  externalTransactionId: string | null;
  status: PaymentStatus;
  invoiceCurrencyCode: string;
  invoiceAmountApplied: { toString(): string };
  settlementCurrencyCode: string;
  fixedConversionRate: { toString(): string };
  rateVersionId: string | null;
  rateSource: PaymentRateSource;
  rateEffectiveAt: Date | null;
  convertedSettlementAmount: { toString(): string };
  processorFeeAmount: { toString(): string } | null;
  actualReceivedAmount: { toString(): string } | null;
  paymentDate: Date;
  receivedAt: Date | null;
  source: PaymentSource;
  notes: string | null;
  createdByUserId: string | null;
  confirmedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function mapRow(row: PaymentRow): PaymentRecord {
  return {
    id: row.id,
    companyId: row.companyId,
    invoiceId: row.invoiceId,
    customerId: row.customerId,
    methodCode: row.methodCode,
    externalTransactionId: row.externalTransactionId,
    status: row.status,
    invoiceCurrencyCode: row.invoiceCurrencyCode.trim(),
    invoiceAmountApplied: toDecimalString(row.invoiceAmountApplied.toString()),
    settlementCurrencyCode: row.settlementCurrencyCode.trim(),
    fixedConversionRate: toDecimalString(row.fixedConversionRate.toString()),
    rateVersionId: row.rateVersionId,
    rateSource: row.rateSource,
    rateEffectiveAt: row.rateEffectiveAt,
    convertedSettlementAmount: toDecimalString(row.convertedSettlementAmount.toString()),
    processorFeeAmount:
      row.processorFeeAmount != null ? toDecimalString(row.processorFeeAmount.toString()) : null,
    actualReceivedAmount:
      row.actualReceivedAmount != null
        ? toDecimalString(row.actualReceivedAmount.toString())
        : null,
    paymentDate: row.paymentDate,
    receivedAt: row.receivedAt,
    source: row.source,
    notes: row.notes,
    createdByUserId: row.createdByUserId,
    confirmedByUserId: row.confirmedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Internal persistence for payment records (TASK-044 / TASK-045).
 * No gateway charging. No hard-delete of SUCCESSFUL payments (BR-004).
 * Lifecycle updates never write confirmed financial columns (BR-005).
 */
export class PrismaPaymentStore {
  async getPaymentById(id: string): Promise<PaymentRecord | null> {
    const prisma = getPrisma();
    const row = await prisma.payment.findUnique({ where: { id } });
    return row ? mapRow(row as PaymentRow) : null;
  }

  async listPaymentsByInvoice(invoiceId: string): Promise<PaymentRecord[]> {
    const prisma = getPrisma();
    const rows = await prisma.payment.findMany({
      where: { invoiceId },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
    });
    return rows.map((row) => mapRow(row as PaymentRow));
  }

  async listPaymentsByCompany(companyId: string): Promise<PaymentRecord[]> {
    return this.listPayments({ companyIds: [companyId] });
  }

  async listPayments(filters: {
    readonly companyIds: readonly string[];
    readonly invoiceId?: string;
    readonly customerId?: string;
    readonly status?: PaymentStatus;
  }): Promise<PaymentRecord[]> {
    if (filters.companyIds.length === 0) {
      return [];
    }
    const prisma = getPrisma();
    const rows = await prisma.payment.findMany({
      where: {
        companyId: { in: [...filters.companyIds] },
        ...(filters.invoiceId ? { invoiceId: filters.invoiceId } : {}),
        ...(filters.customerId ? { customerId: filters.customerId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
    });
    return rows.map((row) => mapRow(row as PaymentRow));
  }

  async createPayment(input: PaymentWriteInput): Promise<PaymentRecord> {
    const prisma = getPrisma();
    const row = await prisma.payment.create({
      data: {
        companyId: input.companyId,
        invoiceId: input.invoiceId,
        customerId: input.customerId,
        methodCode: input.methodCode,
        externalTransactionId: input.externalTransactionId,
        status: input.status,
        invoiceCurrencyCode: input.invoiceCurrencyCode,
        invoiceAmountApplied: input.invoiceAmountApplied,
        settlementCurrencyCode: input.settlementCurrencyCode,
        fixedConversionRate: input.fixedConversionRate,
        rateVersionId: input.rateVersionId,
        rateSource: input.rateSource,
        rateEffectiveAt: input.rateEffectiveAt,
        convertedSettlementAmount: input.convertedSettlementAmount,
        processorFeeAmount: input.processorFeeAmount,
        actualReceivedAmount: input.actualReceivedAmount,
        paymentDate: input.paymentDate,
        receivedAt: input.receivedAt,
        source: input.source,
        notes: input.notes,
        createdByUserId: input.createdByUserId,
        confirmedByUserId: input.confirmedByUserId,
      },
    });
    return mapRow(row as PaymentRow);
  }

  /**
   * Lifecycle update (TASK-045 / TASK-046). Never writes amounts, currencies, or the stored rate.
   * Confirm may complete snapshot lock fields (`rateEffectiveAt`, `rateVersionId`) while PENDING.
   * Concurrent confirm/fail is rejected when the row is no longer PENDING.
   */
  async updatePaymentLifecycle(
    id: string,
    expectedStatus: PaymentStatus,
    patch: {
      readonly status: PaymentStatus;
      readonly receivedAt?: Date | null;
      readonly confirmedByUserId?: string | null;
      readonly rateEffectiveAt?: Date | null;
      readonly rateVersionId?: string | null;
    },
  ): Promise<PaymentRecord | null> {
    const prisma = getPrisma();
    const result = await prisma.payment.updateMany({
      where: { id, status: expectedStatus },
      data: {
        status: patch.status,
        ...(patch.receivedAt !== undefined ? { receivedAt: patch.receivedAt } : {}),
        ...(patch.confirmedByUserId !== undefined
          ? { confirmedByUserId: patch.confirmedByUserId }
          : {}),
        ...(patch.rateEffectiveAt !== undefined ? { rateEffectiveAt: patch.rateEffectiveAt } : {}),
        ...(patch.rateVersionId !== undefined ? { rateVersionId: patch.rateVersionId } : {}),
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.getPaymentById(id);
  }

  /**
   * Hard-delete is only for non-successful rows (e.g. abandoned PENDING). SUCCESSFUL is forbidden (BR-004).
   */
  async deletePaymentIfNotSuccessful(id: string, status: PaymentStatus): Promise<void> {
    assertPaymentHardDeleteAllowed(status);
    const prisma = getPrisma();
    await prisma.payment.delete({ where: { id } });
  }
}
