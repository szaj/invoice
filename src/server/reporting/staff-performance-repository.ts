import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { StaffPerformanceQuery } from "@/domain/reporting/schema";
import type {
  StaffPerformanceSourceInvoice,
  StaffPerformanceSourcePayment,
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

export type StaffPerformanceSourceFilters = StaffPerformanceQuery & {
  readonly companyIds: readonly string[] | "ALL";
  /** When set, Staff visibility: own or assigned invoices only. */
  readonly visibleToStaffUserId?: string | null;
};

/**
 * Read-model for Staff Performance (TASK-084 / §13.3).
 * Created/sent/value use creator; collections use assignee on linked invoices.
 */
export class PrismaStaffPerformanceStore {
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
    filters: StaffPerformanceSourceFilters,
  ): Promise<readonly StaffPerformanceSourceInvoice[]> {
    const prisma = getPrisma();
    const currencyPrecision = await this.loadCurrencyPrecisionMap();

    // Creator-attributed metrics. Staff actors are limited to invoices they created.
    const creatorUserId = filters.visibleToStaffUserId ?? filters.staffUserId ?? null;
    if (filters.visibleToStaffUserId && filters.staffUserId) {
      if (filters.visibleToStaffUserId !== filters.staffUserId) {
        return [];
      }
    }

    const where: Prisma.InvoiceWhereInput = {
      ...(filters.companyIds === "ALL" ? {} : { companyId: { in: [...filters.companyIds] } }),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
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
      ...(creatorUserId ? { createdByUserId: creatorUserId } : {}),
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
        invoiceNumber: true,
        invoiceTotal: true,
        confirmedPaidAmount: true,
        outstandingAmount: true,
        invoiceDate: true,
        assignedStaffUserId: true,
        createdByUserId: true,
        assignedStaff: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: [{ invoiceDate: "desc" }, { id: "asc" }],
    });

    return rows.map((row) => ({
      id: row.id,
      companyId: row.companyId,
      customerId: row.customerId,
      currencyCode: row.currencyCode,
      status: row.status,
      complianceStatus: row.complianceStatus,
      invoiceNumber: row.invoiceNumber,
      invoiceTotal: toDecimalString(row.invoiceTotal),
      confirmedPaidAmount: toDecimalString(row.confirmedPaidAmount),
      outstandingAmount: toDecimalString(row.outstandingAmount),
      invoiceDate: row.invoiceDate,
      assignedStaffUserId: row.assignedStaffUserId,
      assignedStaffName: row.assignedStaff?.name ?? null,
      createdByUserId: row.createdByUserId,
      createdByName: row.createdBy?.name ?? null,
      decimalPrecision: currencyPrecision.get(row.currencyCode) ?? 2,
    }));
  }

  async listPaymentRows(
    filters: StaffPerformanceSourceFilters,
  ): Promise<readonly StaffPerformanceSourcePayment[]> {
    const prisma = getPrisma();
    const currencyPrecision = await this.loadCurrencyPrecisionMap();

    // Collections are linked to assigned invoices. Staff actors see only their assignments.
    const assigneeUserId = filters.visibleToStaffUserId ?? filters.staffUserId ?? null;
    if (filters.visibleToStaffUserId && filters.staffUserId) {
      if (filters.visibleToStaffUserId !== filters.staffUserId) {
        return [];
      }
    }

    const invoiceScope: Prisma.InvoiceWhereInput = {
      ...(assigneeUserId ? { assignedStaffUserId: assigneeUserId } : {}),
      ...(filters.countryCode ? { customer: { countryCode: filters.countryCode } } : {}),
    };

    const hasInvoiceScope = Boolean(assigneeUserId) || Boolean(filters.countryCode);

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
      ...(hasInvoiceScope ? { invoice: invoiceScope } : {}),
    };

    const rows = await prisma.payment.findMany({
      where,
      select: {
        id: true,
        companyId: true,
        invoiceId: true,
        customerId: true,
        status: true,
        invoiceCurrencyCode: true,
        invoiceAmountApplied: true,
        paymentDate: true,
        invoice: {
          select: {
            assignedStaffUserId: true,
            assignedStaff: { select: { name: true } },
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
      status: row.status,
      invoiceCurrencyCode: row.invoiceCurrencyCode,
      invoiceAmountApplied: toDecimalString(row.invoiceAmountApplied),
      paymentDate: row.paymentDate,
      invoiceAssignedStaffUserId: row.invoice.assignedStaffUserId,
      invoiceAssignedStaffName: row.invoice.assignedStaff?.name ?? null,
      invoiceDecimalPrecision: currencyPrecision.get(row.invoiceCurrencyCode) ?? 2,
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
