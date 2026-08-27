import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { ReportingGroupRollupQuery } from "@/domain/reporting/schema";
import type {
  MonthlyBrandMatrixSourceAdjustment,
  MonthlyBrandMatrixSourcePayment,
  ReportingGroupRollupSourceGroup,
  ReportingGroupRollupSourceInvoice,
  ReportingGroupRollupSourcePayment,
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

export type ReportingGroupRollupSourceFilters = ReportingGroupRollupQuery & {
  readonly companyIds: readonly string[] | "ALL";
  /** When set, Staff visibility: own or assigned invoices only. */
  readonly visibleToStaffUserId?: string | null;
};

export type ReportingGroupRollupMatrixFilters = ReportingGroupRollupSourceFilters & {
  readonly year: number;
};

/**
 * Read-model for Reporting Group Rollups (TASK-089 / §13.3).
 * Groups aggregate member companies — reporting_group_id is roll-up only, not ownership.
 */
export class PrismaReportingGroupRollupStore {
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

  async listReportingGroupsInScope(
    companyIds: readonly string[] | "ALL",
    reportingGroupId?: string,
  ): Promise<readonly ReportingGroupRollupSourceGroup[]> {
    const prisma = getPrisma();
    const companyWhere: Prisma.CompanyWhereInput =
      companyIds === "ALL" ? {} : { id: { in: [...companyIds] } };

    const rows = await prisma.companyGroup.findMany({
      where: {
        status: "ACTIVE",
        ...(reportingGroupId ? { id: reportingGroupId } : {}),
        companies: {
          some: companyWhere,
        },
      },
      select: {
        id: true,
        name: true,
        code: true,
        companies: {
          where: companyWhere,
          select: { id: true, displayName: true },
          orderBy: [{ displayName: "asc" }, { id: "asc" }],
        },
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });

    return rows
      .filter((row) => row.companies.length > 0)
      .map((row) => ({
        id: row.id,
        name: row.name,
        code: row.code,
        companies: row.companies.map((company) => ({
          id: company.id,
          displayName: company.displayName,
        })),
      }));
  }

  async loadReportingCurrencyPrecision(reportingCurrencyCode: string): Promise<number> {
    const prisma = getPrisma();
    const currency = await prisma.currency.findUnique({
      where: { code: reportingCurrencyCode },
      select: { decimalPrecision: true },
    });
    return currency?.decimalPrecision ?? 2;
  }

  async listInvoiceRows(
    filters: ReportingGroupRollupSourceFilters,
  ): Promise<readonly ReportingGroupRollupSourceInvoice[]> {
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
        company: { select: { displayName: true, reportingGroupId: true } },
      },
      orderBy: [{ invoiceDate: "desc" }, { id: "asc" }],
    });

    return rows.map((row) => ({
      id: row.id,
      companyId: row.companyId,
      companyDisplayName: row.company.displayName,
      reportingGroupId: row.company.reportingGroupId,
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
    filters: ReportingGroupRollupSourceFilters,
  ): Promise<readonly ReportingGroupRollupSourcePayment[]> {
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
        company: { select: { displayName: true, reportingGroupId: true } },
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
      reportingGroupId: row.company.reportingGroupId,
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

  async listMatrixPaymentRows(
    filters: ReportingGroupRollupMatrixFilters,
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

  async listMatrixAdjustmentRows(
    filters: ReportingGroupRollupMatrixFilters,
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

  private async loadCurrencyPrecisionMap(): Promise<Map<string, number>> {
    const prisma = getPrisma();
    const currencies = await prisma.currency.findMany({
      select: { code: true, decimalPrecision: true },
    });
    return new Map(currencies.map((row) => [row.code, row.decimalPrecision]));
  }
}
