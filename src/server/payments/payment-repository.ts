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
 * Internal persistence for payment records (TASK-044).
 * No public charging API. No hard-delete of SUCCESSFUL payments (BR-004).
 * Confirmed financial field updates are blocked via domain invariants (BR-005); charging/service later.
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
    const prisma = getPrisma();
    const rows = await prisma.payment.findMany({
      where: { companyId },
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
   * Hard-delete is only for non-successful rows (e.g. abandoned PENDING). SUCCESSFUL is forbidden (BR-004).
   */
  async deletePaymentIfNotSuccessful(id: string, status: PaymentStatus): Promise<void> {
    assertPaymentHardDeleteAllowed(status);
    const prisma = getPrisma();
    await prisma.payment.delete({ where: { id } });
  }
}
