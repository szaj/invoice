import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  computeOutstandingAgeDays,
  isOutstandingReportEligible,
} from "@/domain/reporting/outstanding-report";
import type { ResolvedOutstandingReportQuery } from "@/domain/reporting/schema";
import type {
  OutstandingReportRow,
  OutstandingReportSortDir,
  OutstandingReportSortField,
} from "@/domain/reporting/types";
import { nowUtc } from "@/lib/time";
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

export type OutstandingReportSourceFilters = Omit<
  ResolvedOutstandingReportQuery,
  "companyId" | "reportingGroupId" | "page" | "pageSize" | "sortBy" | "sortDir"
> & {
  readonly companyIds: readonly string[] | "ALL";
  /** When set, Staff visibility: own or assigned invoices only. */
  readonly visibleToStaffUserId?: string | null;
  readonly page: number;
  readonly pageSize: number;
  readonly sortBy: OutstandingReportSortField;
  readonly sortDir: OutstandingReportSortDir;
  /** Reference instant for age days (defaults to now). */
  readonly asOf?: Date;
};

export type OutstandingReportPage = {
  readonly rows: OutstandingReportRow[];
  readonly totalCount: number;
};

/**
 * Age is derived from due date: older due → higher age.
 * Sort age desc ≡ dueDate asc; age asc ≡ dueDate desc.
 */
function buildOrderBy(
  sortBy: OutstandingReportSortField,
  sortDir: OutstandingReportSortDir,
): Prisma.InvoiceOrderByWithRelationInput[] {
  const dir = sortDir;
  switch (sortBy) {
    case "invoiceNumber":
      return [{ invoiceNumber: dir }, { id: "asc" }];
    case "customer":
      return [{ customer: { displayName: dir } }, { id: "asc" }];
    case "company":
      return [{ company: { displayName: dir } }, { id: "asc" }];
    case "currency":
      return [{ currencyCode: dir }, { id: "asc" }];
    case "outstanding":
      return [{ outstandingAmount: dir }, { id: "asc" }];
    case "staff":
      return [{ assignedStaff: { name: dir } }, { id: "asc" }];
    case "age":
      // Higher age = earlier due date.
      return [{ dueDate: dir === "desc" ? "asc" : "desc" }, { id: "asc" }];
    case "dueDate":
    default:
      return [{ dueDate: dir }, { id: "asc" }];
  }
}

/**
 * Read-model for Outstanding Report rows (TASK-080 / §13.3).
 * Cancelled/draft excluded; open stored outstanding only (BR-009 / BR-019).
 */
export class PrismaOutstandingReportStore {
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

  async listOutstandingReportPage(
    filters: OutstandingReportSourceFilters,
  ): Promise<OutstandingReportPage> {
    const prisma = getPrisma();
    const currencyPrecision = await this.loadCurrencyPrecisionMap();
    const asOf = filters.asOf ?? nowUtc();

    const where: Prisma.InvoiceWhereInput = {
      // BR-019: cancelled (and draft) are not collectible outstanding by default.
      status: filters.invoiceStatus ? filters.invoiceStatus : { notIn: ["CANCELLED", "DRAFT"] },
      outstandingAmount: { gt: 0 },
      ...(filters.companyIds === "ALL" ? {} : { companyId: { in: [...filters.companyIds] } }),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.staffUserId ? { assignedStaffUserId: filters.staffUserId } : {}),
      ...(filters.complianceStatus ? { complianceStatus: filters.complianceStatus } : {}),
      ...(filters.invoiceCurrency ? { currencyCode: filters.invoiceCurrency } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            dueDate: {
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

    // If caller filters status to a non-collectible value, force empty via AND.
    if (
      filters.invoiceStatus &&
      !isOutstandingReportEligible({
        status: filters.invoiceStatus,
        outstandingAmount: "1",
      })
    ) {
      return { rows: [], totalCount: 0 };
    }

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
          outstandingAmount: true,
          dueDate: true,
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
        dueDate: toDateOnlyIso(row.dueDate),
        ageDays: computeOutstandingAgeDays(row.dueDate, asOf),
        currencyCode: row.currencyCode,
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
