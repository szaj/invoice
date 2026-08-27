import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { ComplianceStatus } from "@/domain/compliance/types";
import type { InvoiceStatus } from "@/domain/invoices/types";
import type { CustomerReportSourceInvoice } from "@/domain/reporting/types";
import { getPrisma } from "@/server/db/client";

function endOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999),
  );
}

function toDecimalString(value: { toString(): string }): string {
  return value.toString();
}

export type CustomerReportSourceFilters = {
  readonly companyIds: readonly string[] | "ALL";
  readonly customerId?: string;
  readonly staffUserId?: string;
  readonly dateFrom?: Date;
  readonly dateTo?: Date;
  readonly invoiceStatus?: InvoiceStatus;
  readonly invoiceCurrency?: string;
  readonly countryCode?: string;
  readonly complianceStatus?: ComplianceStatus;
  /** When set, Staff visibility: own or assigned invoices only. */
  readonly visibleToStaffUserId?: string | null;
};

/**
 * Read-model for Customer Report source invoices (TASK-082 / §13.3).
 * Collectible invoices only — draft/cancelled excluded at query time.
 */
export class PrismaCustomerReportStore {
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

  async listCustomerReportInvoices(
    filters: CustomerReportSourceFilters,
  ): Promise<readonly CustomerReportSourceInvoice[]> {
    // Draft/cancelled are never collectible for this report (BR-019 / TASK-029 rule).
    if (filters.invoiceStatus === "DRAFT" || filters.invoiceStatus === "CANCELLED") {
      return [];
    }

    const prisma = getPrisma();
    const currencyPrecision = await this.loadCurrencyPrecisionMap();

    const where: Prisma.InvoiceWhereInput = {
      status: filters.invoiceStatus ? filters.invoiceStatus : { notIn: ["DRAFT", "CANCELLED"] },
      ...(filters.companyIds === "ALL" ? {} : { companyId: { in: [...filters.companyIds] } }),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.staffUserId ? { assignedStaffUserId: filters.staffUserId } : {}),
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
        customerId: true,
        currencyCode: true,
        status: true,
        invoiceTotal: true,
        confirmedPaidAmount: true,
        outstandingAmount: true,
        customer: { select: { displayName: true } },
      },
    });

    return rows.map((row) => ({
      customerId: row.customerId,
      customerDisplayName: row.customer.displayName,
      currencyCode: row.currencyCode,
      status: row.status,
      invoiceTotal: toDecimalString(row.invoiceTotal),
      confirmedPaidAmount: toDecimalString(row.confirmedPaidAmount),
      outstandingAmount: toDecimalString(row.outstandingAmount),
      decimalPrecision: currencyPrecision.get(row.currencyCode) ?? 2,
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
