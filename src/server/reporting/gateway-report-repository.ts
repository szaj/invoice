import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { GatewayReportQuery } from "@/domain/reporting/schema";
import type {
  GatewayReportSourcePayment,
  GatewayReportSourceRefund,
} from "@/domain/reporting/types";
import { getPrisma } from "@/server/db/client";

function endOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999),
  );
}

function toDecimalString(value: { toString(): string }): string {
  return value.toString();
}

export type GatewayReportSourceFilters = GatewayReportQuery & {
  readonly companyIds: readonly string[] | "ALL";
  /** When set, Staff visibility: own or assigned invoices only. */
  readonly visibleToStaffUserId?: string | null;
};

/**
 * Read-model for Gateway Report (TASK-085 / §13.3).
 * Payments + PROCESSED REFUND adjustments by gateway × settlement currency.
 */
export class PrismaGatewayReportStore {
  async listCompanyIdsInReportingGroup(reportingGroupId: string): Promise<readonly string[]> {
    const prisma = getPrisma();
    const rows = await prisma.company.findMany({
      where: { reportingGroupId },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  /** Filter options only — membership is not authorization. */
  async listReportingGroupOptions(): Promise<readonly { id: string; name: string }[]> {
    const prisma = getPrisma();
    const rows = await prisma.companyGroup.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
    return rows.map((row) => ({ id: row.id, name: row.name }));
  }

  async listPaymentRows(
    filters: GatewayReportSourceFilters,
  ): Promise<readonly GatewayReportSourcePayment[]> {
    const prisma = getPrisma();
    const currencyPrecision = await this.loadCurrencyPrecisionMap();

    const where: Prisma.PaymentWhereInput = {
      ...(filters.companyIds === "ALL" ? {} : { companyId: { in: [...filters.companyIds] } }),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.paymentStatus ? { status: filters.paymentStatus } : {}),
      ...(filters.paymentMethod ? { methodCode: filters.paymentMethod } : {}),
      ...(filters.complianceStatus ? { complianceStatus: filters.complianceStatus } : {}),
      ...(filters.invoiceCurrency ? { invoiceCurrencyCode: filters.invoiceCurrency } : {}),
      ...(filters.settlementCurrency ? { settlementCurrencyCode: filters.settlementCurrency } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            paymentDate: {
              ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
              ...(filters.dateTo ? { lte: endOfUtcDay(filters.dateTo) } : {}),
            },
          }
        : {}),
      ...(filters.countryCode ||
      filters.staffUserId ||
      filters.visibleToStaffUserId ||
      filters.invoiceStatus
        ? {
            invoice: {
              ...(filters.invoiceStatus ? { status: filters.invoiceStatus } : {}),
              ...(filters.staffUserId ? { assignedStaffUserId: filters.staffUserId } : {}),
              ...(filters.countryCode ? { customer: { countryCode: filters.countryCode } } : {}),
              ...(filters.visibleToStaffUserId
                ? {
                    OR: [
                      { createdByUserId: filters.visibleToStaffUserId },
                      { assignedStaffUserId: filters.visibleToStaffUserId },
                    ],
                  }
                : {}),
            },
          }
        : {}),
    };

    const rows = await prisma.payment.findMany({
      where,
      select: {
        id: true,
        companyId: true,
        invoiceId: true,
        customerId: true,
        methodCode: true,
        status: true,
        complianceStatus: true,
        invoiceCurrencyCode: true,
        settlementCurrencyCode: true,
        convertedSettlementAmount: true,
        processorFeeAmount: true,
        actualReceivedAmount: true,
        paymentDate: true,
        invoice: {
          select: {
            createdByUserId: true,
            assignedStaffUserId: true,
          },
        },
      },
      orderBy: [{ paymentDate: "desc" }, { id: "asc" }],
    });

    return rows.map((row) => ({
      id: row.id,
      companyId: row.companyId,
      invoiceId: row.invoiceId,
      customerId: row.customerId,
      methodCode: row.methodCode,
      status: row.status,
      complianceStatus: row.complianceStatus,
      invoiceCurrencyCode: row.invoiceCurrencyCode,
      settlementCurrencyCode: row.settlementCurrencyCode,
      convertedSettlementAmount: toDecimalString(row.convertedSettlementAmount),
      processorFeeAmount:
        row.processorFeeAmount == null ? null : toDecimalString(row.processorFeeAmount),
      actualReceivedAmount:
        row.actualReceivedAmount == null ? null : toDecimalString(row.actualReceivedAmount),
      paymentDate: row.paymentDate,
      invoiceCreatedByUserId: row.invoice.createdByUserId,
      invoiceAssignedStaffUserId: row.invoice.assignedStaffUserId,
      settlementDecimalPrecision: currencyPrecision.get(row.settlementCurrencyCode) ?? 2,
    }));
  }

  async listRefundRows(
    filters: GatewayReportSourceFilters,
  ): Promise<readonly GatewayReportSourceRefund[]> {
    const prisma = getPrisma();
    const currencyPrecision = await this.loadCurrencyPrecisionMap();

    // When paymentStatus is set and is not SUCCESSFUL, refunds on successful payments are N/A.
    if (filters.paymentStatus && filters.paymentStatus !== "SUCCESSFUL") {
      return [];
    }

    const paymentScope: Prisma.PaymentWhereInput = {
      ...(filters.companyIds === "ALL" ? {} : { companyId: { in: [...filters.companyIds] } }),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.paymentMethod ? { methodCode: filters.paymentMethod } : {}),
      ...(filters.complianceStatus ? { complianceStatus: filters.complianceStatus } : {}),
      ...(filters.invoiceCurrency ? { invoiceCurrencyCode: filters.invoiceCurrency } : {}),
      ...(filters.settlementCurrency ? { settlementCurrencyCode: filters.settlementCurrency } : {}),
      ...(filters.countryCode ||
      filters.staffUserId ||
      filters.visibleToStaffUserId ||
      filters.invoiceStatus
        ? {
            invoice: {
              ...(filters.invoiceStatus ? { status: filters.invoiceStatus } : {}),
              ...(filters.staffUserId ? { assignedStaffUserId: filters.staffUserId } : {}),
              ...(filters.countryCode ? { customer: { countryCode: filters.countryCode } } : {}),
              ...(filters.visibleToStaffUserId
                ? {
                    OR: [
                      { createdByUserId: filters.visibleToStaffUserId },
                      { assignedStaffUserId: filters.visibleToStaffUserId },
                    ],
                  }
                : {}),
            },
          }
        : {}),
    };

    const where: Prisma.PaymentAdjustmentWhereInput = {
      type: "REFUND",
      status: "PROCESSED",
      ...(filters.companyIds === "ALL" ? {} : { companyId: { in: [...filters.companyIds] } }),
      ...(filters.dateFrom || filters.dateTo
        ? {
            effectiveDate: {
              ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
              ...(filters.dateTo ? { lte: endOfUtcDay(filters.dateTo) } : {}),
            },
          }
        : {}),
      payment: paymentScope,
    };

    const rows = await prisma.paymentAdjustment.findMany({
      where,
      select: {
        id: true,
        companyId: true,
        paymentId: true,
        amount: true,
        settlementAmount: true,
        effectiveDate: true,
        payment: {
          select: {
            methodCode: true,
            settlementCurrencyCode: true,
          },
        },
      },
      orderBy: [{ effectiveDate: "desc" }, { id: "asc" }],
    });

    return rows.map((row) => {
      const settlementCurrencyCode = row.payment.settlementCurrencyCode;
      const refundAmount =
        row.settlementAmount == null
          ? toDecimalString(row.amount)
          : toDecimalString(row.settlementAmount);
      return {
        id: row.id,
        companyId: row.companyId,
        paymentId: row.paymentId,
        methodCode: row.payment.methodCode,
        settlementCurrencyCode,
        refundAmount,
        effectiveDate: row.effectiveDate,
        settlementDecimalPrecision: currencyPrecision.get(settlementCurrencyCode) ?? 2,
      };
    });
  }

  private async loadCurrencyPrecisionMap(): Promise<Map<string, number>> {
    const prisma = getPrisma();
    const currencies = await prisma.currency.findMany({
      select: { code: true, decimalPrecision: true },
    });
    return new Map(currencies.map((row) => [row.code, row.decimalPrecision]));
  }
}
