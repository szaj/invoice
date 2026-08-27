import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { MonthlyBrandMatrixQuery } from "@/domain/reporting/schema";
import type {
  MonthlyBrandMatrixSourceAdjustment,
  MonthlyBrandMatrixSourceCompany,
  MonthlyBrandMatrixSourcePayment,
} from "@/domain/reporting/types";
import { yearUtcBounds } from "@/domain/reporting/monthly-brand-matrix";
import { getPrisma } from "@/server/db/client";

function endOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999),
  );
}

function toDecimalString(value: { toString(): string }): string {
  return value.toString();
}

export type MonthlyBrandMatrixSourceFilters = MonthlyBrandMatrixQuery & {
  readonly year: number;
  readonly companyIds: readonly string[] | "ALL";
  /** When set, Staff visibility: own or assigned invoices only. */
  readonly visibleToStaffUserId?: string | null;
};

/**
 * Read-model for Monthly Brand / CB-RF Matrix (TASK-088 / §13.3.1).
 * Payment date for gross; adjustment effective date for CB/RF.
 */
export class PrismaMonthlyBrandMatrixStore {
  async listCompanyIdsInReportingGroup(reportingGroupId: string): Promise<readonly string[]> {
    const prisma = getPrisma();
    const rows = await prisma.company.findMany({
      where: { reportingGroupId },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async listReportingGroupOptions(): Promise<readonly { id: string; name: string }[]> {
    const prisma = getPrisma();
    const rows = await prisma.companyGroup.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
    return rows.map((row) => ({ id: row.id, name: row.name }));
  }

  async listCompanyColumns(
    companyIds: readonly string[] | "ALL",
  ): Promise<readonly MonthlyBrandMatrixSourceCompany[]> {
    const prisma = getPrisma();
    const rows = await prisma.company.findMany({
      where: companyIds === "ALL" ? {} : { id: { in: [...companyIds] } },
      select: { id: true, displayName: true },
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
    });
    return rows.map((row) => ({ id: row.id, displayName: row.displayName }));
  }

  async listPaymentRows(
    filters: MonthlyBrandMatrixSourceFilters,
  ): Promise<readonly MonthlyBrandMatrixSourcePayment[]> {
    const prisma = getPrisma();
    const currencyPrecision = await this.loadCurrencyPrecisionMap();
    const { from, to } = yearUtcBounds(filters.year);

    const where: Prisma.PaymentWhereInput = {
      ...(filters.companyIds === "ALL" ? {} : { companyId: { in: [...filters.companyIds] } }),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.paymentStatus ? { status: filters.paymentStatus } : {}),
      ...(filters.paymentMethod ? { methodCode: filters.paymentMethod } : {}),
      ...(filters.complianceStatus ? { complianceStatus: filters.complianceStatus } : {}),
      ...(filters.invoiceCurrency ? { invoiceCurrencyCode: filters.invoiceCurrency } : {}),
      ...(filters.settlementCurrency ? { settlementCurrencyCode: filters.settlementCurrency } : {}),
      paymentDate: {
        gte: from,
        lte: endOfUtcDay(to),
      },
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
        status: true,
        settlementCurrencyCode: true,
        convertedSettlementAmount: true,
        paymentDate: true,
      },
      orderBy: [{ paymentDate: "asc" }, { id: "asc" }],
    });

    return rows.map((row) => ({
      id: row.id,
      companyId: row.companyId,
      status: row.status,
      settlementCurrencyCode: row.settlementCurrencyCode,
      convertedSettlementAmount: toDecimalString(row.convertedSettlementAmount),
      paymentDate: row.paymentDate,
      settlementDecimalPrecision: currencyPrecision.get(row.settlementCurrencyCode) ?? 2,
    }));
  }

  async listAdjustmentRows(
    filters: MonthlyBrandMatrixSourceFilters,
  ): Promise<readonly MonthlyBrandMatrixSourceAdjustment[]> {
    const prisma = getPrisma();
    const currencyPrecision = await this.loadCurrencyPrecisionMap();
    const { from, to } = yearUtcBounds(filters.year);

    const paymentScope: Prisma.PaymentWhereInput = {
      ...(filters.companyIds === "ALL" ? {} : { companyId: { in: [...filters.companyIds] } }),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.paymentMethod ? { methodCode: filters.paymentMethod } : {}),
      ...(filters.complianceStatus ? { complianceStatus: filters.complianceStatus } : {}),
      ...(filters.invoiceCurrency ? { invoiceCurrencyCode: filters.invoiceCurrency } : {}),
      ...(filters.settlementCurrency ? { settlementCurrencyCode: filters.settlementCurrency } : {}),
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

    const where: Prisma.PaymentAdjustmentWhereInput = {
      ...(filters.companyIds === "ALL" ? {} : { companyId: { in: [...filters.companyIds] } }),
      effectiveDate: {
        gte: from,
        lte: endOfUtcDay(to),
      },
      payment: paymentScope,
    };

    const rows = await prisma.paymentAdjustment.findMany({
      where,
      select: {
        id: true,
        companyId: true,
        paymentId: true,
        type: true,
        status: true,
        amount: true,
        settlementAmount: true,
        effectiveDate: true,
        payment: {
          select: {
            settlementCurrencyCode: true,
          },
        },
      },
      orderBy: [{ effectiveDate: "asc" }, { id: "asc" }],
    });

    return rows.map((row) => {
      const settlementCurrencyCode = row.payment.settlementCurrencyCode;
      return {
        id: row.id,
        companyId: row.companyId,
        paymentId: row.paymentId,
        type: row.type,
        status: row.status,
        amount: toDecimalString(row.amount),
        settlementAmount:
          row.settlementAmount == null ? null : toDecimalString(row.settlementAmount),
        settlementCurrencyCode,
        effectiveDate: row.effectiveDate,
        settlementDecimalPrecision: currencyPrecision.get(settlementCurrencyCode) ?? 2,
      };
    });
  }

  async loadReportingCurrencyPrecision(reportingCurrencyCode: string): Promise<number> {
    const prisma = getPrisma();
    const row = await prisma.currency.findUnique({
      where: { code: reportingCurrencyCode },
      select: { decimalPrecision: true },
    });
    return row?.decimalPrecision ?? 2;
  }

  private async loadCurrencyPrecisionMap(): Promise<Map<string, number>> {
    const prisma = getPrisma();
    const currencies = await prisma.currency.findMany({
      select: { code: true, decimalPrecision: true },
    });
    return new Map(currencies.map((row) => [row.code, row.decimalPrecision]));
  }
}
