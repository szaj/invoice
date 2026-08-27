import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { ResolvedInvoiceReportQuery } from "@/domain/reporting/schema";
import type {
  InvoiceReportRow,
  InvoiceReportSortDir,
  InvoiceReportSortField,
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

function toDateOnlyIso(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export type InvoiceReportSourceFilters = Omit<
  ResolvedInvoiceReportQuery,
  "companyId" | "reportingGroupId" | "page" | "pageSize" | "sortBy" | "sortDir"
> & {
  readonly companyIds: readonly string[] | "ALL";
  /** When set, Staff visibility: own or assigned invoices only. */
  readonly visibleToStaffUserId?: string | null;
  readonly page: number;
  readonly pageSize: number;
  readonly sortBy: InvoiceReportSortField;
  readonly sortDir: InvoiceReportSortDir;
};

export type InvoiceReportPage = {
  readonly rows: InvoiceReportRow[];
  readonly totalCount: number;
};

function buildOrderBy(
  sortBy: InvoiceReportSortField,
  sortDir: InvoiceReportSortDir,
): Prisma.InvoiceOrderByWithRelationInput[] {
  const dir = sortDir;
  switch (sortBy) {
    case "invoiceNumber":
      return [{ invoiceNumber: dir }, { id: "asc" }];
    case "customer":
      return [{ customer: { displayName: dir } }, { id: "asc" }];
    case "company":
      return [{ company: { displayName: dir } }, { id: "asc" }];
    case "dueDate":
      return [{ dueDate: dir }, { id: "asc" }];
    case "currency":
      return [{ currencyCode: dir }, { id: "asc" }];
    case "total":
      return [{ invoiceTotal: dir }, { id: "asc" }];
    case "paid":
      return [{ confirmedPaidAmount: dir }, { id: "asc" }];
    case "balance":
      return [{ outstandingAmount: dir }, { id: "asc" }];
    case "status":
      return [{ status: dir }, { id: "asc" }];
    case "staff":
      return [{ assignedStaff: { name: dir } }, { id: "asc" }];
    case "invoiceDate":
    default:
      return [{ invoiceDate: dir }, { id: "asc" }];
  }
}

/**
 * Read-model for Invoice Report rows (TASK-078 / §13.3).
 */
export class PrismaInvoiceReportStore {
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

  async listInvoiceReportPage(filters: InvoiceReportSourceFilters): Promise<InvoiceReportPage> {
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

    const skip = (filters.page - 1) * filters.pageSize;
    const orderBy = buildOrderBy(filters.sortBy, filters.sortDir);

    const [totalCount, rows] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        select: {
          id: true,
          invoiceNumber: true,
          customerId: true,
          companyId: true,
          currencyCode: true,
          status: true,
          invoiceTotal: true,
          confirmedPaidAmount: true,
          outstandingAmount: true,
          dueDate: true,
          invoiceDate: true,
          assignedStaffUserId: true,
          customer: { select: { displayName: true } },
          company: { select: { displayName: true } },
          assignedStaff: { select: { name: true } },
        },
        orderBy,
        skip,
        take: filters.pageSize,
      }),
    ]);

    return {
      totalCount,
      rows: rows.map((row) => ({
        id: row.id,
        invoiceNumber: row.invoiceNumber,
        customerId: row.customerId,
        customerDisplayName: row.customer.displayName,
        companyId: row.companyId,
        companyDisplayName: row.company.displayName,
        invoiceDate: toDateOnlyIso(row.invoiceDate),
        dueDate: toDateOnlyIso(row.dueDate),
        currencyCode: row.currencyCode,
        invoiceTotal: toDecimalString(row.invoiceTotal),
        confirmedPaidAmount: toDecimalString(row.confirmedPaidAmount),
        outstandingAmount: toDecimalString(row.outstandingAmount),
        status: row.status,
        assignedStaffUserId: row.assignedStaffUserId,
        assignedStaffName: row.assignedStaff?.name ?? null,
        decimalPrecision: currencyPrecision.get(row.currencyCode) ?? 2,
      })),
    };
  }

  private async loadCurrencyPrecisionMap(): Promise<Map<string, number>> {
    const prisma = getPrisma();
    const currencies = await prisma.currency.findMany({
      select: { code: true, decimalPrecision: true },
    });
    return new Map(currencies.map((row) => [row.code, row.decimalPrecision]));
  }
}
