import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { CompanyPerformanceQuery } from "@/domain/reporting/schema";
import type {
  CompanyPerformanceSourceInvoice,
  CompanyPerformanceSourcePayment,
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

export type CompanyPerformanceSourceFilters = CompanyPerformanceQuery & {
  readonly companyIds: readonly string[] | "ALL";
  /** When set, Staff visibility: own or assigned invoices only. */
  readonly visibleToStaffUserId?: string | null;
};

/**
 * Read-model for Company Performance (TASK-083 / §13.3).
 * Ownership is always the invoice/payment company_id — reporting group is filter-only.
 */
export class PrismaCompanyPerformanceStore {
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

  async listInvoiceRows(
    filters: CompanyPerformanceSourceFilters,
  ): Promise<readonly CompanyPerformanceSourceInvoice[]> {
    const prisma = getPrisma();
    const currencyPrecision = await this.loadCurrencyPrecisionMap();

    const where: Prisma.InvoiceWhereInput = {
      ...(filters.companyIds === "ALL" ? {} : { companyId: { in: [...filters.companyIds] } }),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.staffUserId ? { assignedStaffUserId: filters.staffUserId } : {}),
      ...(filters.invoiceStatus ? { status: filters.invoiceStatus } : {}),
      ...(filters.complianceStatus ? { complianceStatus: filters.complianceStatus } : {}),
      ...(filters.invoiceCurrency ? { currencyCode: filters.invoiceCurrency } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            invoiceDate: {
              ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
              ...(filters.dateTo ? { lte: endOfUtcDay(filters.dateTo) } : {}),
            },
          }
        : {}),
      ...(filters.countryCode ? { customer: { countryCode: filters.countryCode } } : {}),
      ...(filters.visibleToStaffUserId
        ? {
            OR: [
              { createdByUserId: filters.visibleToStaffUserId },
              { assignedStaffUserId: filters.visibleToStaffUserId },
            ],
          }
        : {}),
    };

    const rows = await prisma.invoice.findMany({
      where,
      select: {
        id: true,
        companyId: true,
        customerId: true,
        currencyCode: true,
        status: true,
        complianceStatus: true,
        invoiceTotal: true,
        confirmedPaidAmount: true,
        outstandingAmount: true,
        dueDate: true,
        invoiceDate: true,
        assignedStaffUserId: true,
        createdByUserId: true,
        company: { select: { displayName: true } },
      },
      orderBy: [{ invoiceDate: "desc" }, { id: "asc" }],
    });

    return rows.map((row) => ({
      id: row.id,
      companyId: row.companyId,
      companyDisplayName: row.company.displayName,
      customerId: row.customerId,
      currencyCode: row.currencyCode,
      status: row.status,
      complianceStatus: row.complianceStatus,
      invoiceTotal: toDecimalString(row.invoiceTotal),
      confirmedPaidAmount: toDecimalString(row.confirmedPaidAmount),
      outstandingAmount: toDecimalString(row.outstandingAmount),
      dueDate: row.dueDate,
      invoiceDate: row.invoiceDate,
      assignedStaffUserId: row.assignedStaffUserId,
      createdByUserId: row.createdByUserId,
      decimalPrecision: currencyPrecision.get(row.currencyCode) ?? 2,
    }));
  }

  async listPaymentRows(
    filters: CompanyPerformanceSourceFilters,
  ): Promise<readonly CompanyPerformanceSourcePayment[]> {
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
      ...(filters.countryCode || filters.staffUserId || filters.visibleToStaffUserId
        ? {
            invoice: {
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
        invoiceAmountApplied: true,
        settlementCurrencyCode: true,
        convertedSettlementAmount: true,
        processorFeeAmount: true,
        actualReceivedAmount: true,
        paymentDate: true,
        company: { select: { displayName: true } },
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
      companyDisplayName: row.company.displayName,
      invoiceId: row.invoiceId,
      customerId: row.customerId,
      methodCode: row.methodCode,
      status: row.status,
      complianceStatus: row.complianceStatus,
      invoiceCurrencyCode: row.invoiceCurrencyCode,
      invoiceAmountApplied: toDecimalString(row.invoiceAmountApplied),
      settlementCurrencyCode: row.settlementCurrencyCode,
      convertedSettlementAmount: toDecimalString(row.convertedSettlementAmount),
      processorFeeAmount:
        row.processorFeeAmount == null ? null : toDecimalString(row.processorFeeAmount),
      actualReceivedAmount:
        row.actualReceivedAmount == null ? null : toDecimalString(row.actualReceivedAmount),
      paymentDate: row.paymentDate,
      invoiceCreatedByUserId: row.invoice.createdByUserId,
      invoiceAssignedStaffUserId: row.invoice.assignedStaffUserId,
      invoiceDecimalPrecision: currencyPrecision.get(row.invoiceCurrencyCode) ?? 2,
      settlementDecimalPrecision: currencyPrecision.get(row.settlementCurrencyCode) ?? 2,
    }));
  }

  private async loadCurrencyPrecisionMap(): Promise<Map<string, number>> {
    const prisma = getPrisma();
    const currencies = await prisma.currency.findMany({
      select: { code: true, decimalPrecision: true },
    });
    return new Map(currencies.map((row) => [row.code, row.decimalPrecision]));
  }
}
