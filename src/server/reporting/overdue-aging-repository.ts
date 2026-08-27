import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { ComplianceStatus } from "@/domain/compliance/types";
import type { OverdueAgingSourceInvoice } from "@/domain/reporting/types";
import { nowUtc } from "@/lib/time";
import { getPrisma } from "@/server/db/client";

function toUtcDateOnly(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function toDecimalString(value: { toString(): string }): string {
  return value.toString();
}

export type OverdueAgingSourceFilters = {
  readonly companyIds: readonly string[] | "ALL";
  readonly customerId?: string;
  readonly staffUserId?: string;
  readonly invoiceCurrency?: string;
  readonly countryCode?: string;
  readonly complianceStatus?: ComplianceStatus;
  /** When set, Staff visibility: own or assigned invoices only. */
  readonly visibleToStaffUserId?: string | null;
  /** Reference instant for overdue cutoff (defaults to now). */
  readonly asOf?: Date;
};

/**
 * Read-model for Overdue Aging Report source invoices (TASK-081 / BR-018).
 * Past-due open balances only; draft/paid/cancelled excluded.
 */
export class PrismaOverdueAgingStore {
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

  async listOverdueAgingInvoices(
    filters: OverdueAgingSourceFilters,
  ): Promise<readonly OverdueAgingSourceInvoice[]> {
    const prisma = getPrisma();
    const currencyPrecision = await this.loadCurrencyPrecisionMap();
    const asOf = filters.asOf ?? nowUtc();
    // BR-018: due date must be strictly before today (UTC date-only).
    const overdueBefore = toUtcDateOnly(asOf);

    const where: Prisma.InvoiceWhereInput = {
      status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
      outstandingAmount: { gt: 0 },
      dueDate: { lt: overdueBefore },
      ...(filters.companyIds === "ALL" ? {} : { companyId: { in: [...filters.companyIds] } }),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.staffUserId ? { assignedStaffUserId: filters.staffUserId } : {}),
      ...(filters.complianceStatus ? { complianceStatus: filters.complianceStatus } : {}),
      ...(filters.invoiceCurrency ? { currencyCode: filters.invoiceCurrency } : {}),
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
        status: true,
        dueDate: true,
        outstandingAmount: true,
        currencyCode: true,
      },
    });

    return rows.map((row) => ({
      status: row.status,
      dueDate: row.dueDate,
      outstandingAmount: toDecimalString(row.outstandingAmount),
      currencyCode: row.currencyCode,
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
