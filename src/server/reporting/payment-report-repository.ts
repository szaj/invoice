import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { ResolvedPaymentReportQuery } from "@/domain/reporting/schema";
import type {
  PaymentReportRow,
  PaymentReportSortDir,
  PaymentReportSortField,
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

export type PaymentReportSourceFilters = Omit<
  ResolvedPaymentReportQuery,
  "companyId" | "reportingGroupId" | "page" | "pageSize" | "sortBy" | "sortDir"
> & {
  readonly companyIds: readonly string[] | "ALL";
  /** When set, Staff visibility: own or assigned invoices only. */
  readonly visibleToStaffUserId?: string | null;
  readonly page: number;
  readonly pageSize: number;
  readonly sortBy: PaymentReportSortField;
  readonly sortDir: PaymentReportSortDir;
};

export type PaymentReportPage = {
  readonly rows: PaymentReportRow[];
  readonly totalCount: number;
};

function buildOrderBy(
  sortBy: PaymentReportSortField,
  sortDir: PaymentReportSortDir,
): Prisma.PaymentOrderByWithRelationInput[] {
  const dir = sortDir;
  switch (sortBy) {
    case "invoice":
      return [{ invoice: { invoiceNumber: dir } }, { id: "asc" }];
    case "customer":
      return [{ customer: { displayName: dir } }, { id: "asc" }];
    case "method":
      return [{ methodCode: dir }, { id: "asc" }];
    case "transactionId":
      return [{ externalTransactionId: dir }, { id: "asc" }];
    case "applied":
      return [{ invoiceAmountApplied: dir }, { id: "asc" }];
    case "rate":
      return [{ fixedConversionRate: dir }, { id: "asc" }];
    case "settlement":
      return [{ convertedSettlementAmount: dir }, { id: "asc" }];
    case "fee":
      return [{ processorFeeAmount: dir }, { id: "asc" }];
    case "actualReceived":
      return [{ actualReceivedAmount: dir }, { id: "asc" }];
    case "currency":
      return [{ settlementCurrencyCode: dir }, { id: "asc" }];
    case "status":
      return [{ status: dir }, { id: "asc" }];
    case "date":
    default:
      return [{ paymentDate: dir }, { id: "asc" }];
  }
}

/**
 * Read-model for Payment Report rows (TASK-079 / §13.3).
 * Selects stored snapshot fields only — never resolves live Admin rates.
 */
export class PrismaPaymentReportStore {
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

  async listPaymentReportPage(filters: PaymentReportSourceFilters): Promise<PaymentReportPage> {
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

    const skip = (filters.page - 1) * filters.pageSize;
    const orderBy = buildOrderBy(filters.sortBy, filters.sortDir);

    const [totalCount, rows] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        select: {
          id: true,
          invoiceId: true,
          customerId: true,
          methodCode: true,
          externalTransactionId: true,
          invoiceCurrencyCode: true,
          invoiceAmountApplied: true,
          fixedConversionRate: true,
          rateSource: true,
          settlementCurrencyCode: true,
          convertedSettlementAmount: true,
          processorFeeAmount: true,
          actualReceivedAmount: true,
          paymentDate: true,
          status: true,
          invoice: { select: { invoiceNumber: true } },
          customer: { select: { displayName: true } },
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
        invoiceId: row.invoiceId,
        invoiceNumber: row.invoice.invoiceNumber,
        customerId: row.customerId,
        customerDisplayName: row.customer.displayName,
        methodCode: row.methodCode,
        externalTransactionId: row.externalTransactionId,
        invoiceCurrencyCode: row.invoiceCurrencyCode,
        invoiceAmountApplied: toDecimalString(row.invoiceAmountApplied),
        fixedConversionRate: toDecimalString(row.fixedConversionRate),
        rateSource: row.rateSource,
        settlementCurrencyCode: row.settlementCurrencyCode,
        convertedSettlementAmount: toDecimalString(row.convertedSettlementAmount),
        processorFeeAmount:
          row.processorFeeAmount == null ? null : toDecimalString(row.processorFeeAmount),
        actualReceivedAmount:
          row.actualReceivedAmount == null ? null : toDecimalString(row.actualReceivedAmount),
        paymentDate: toDateOnlyIso(row.paymentDate),
        status: row.status,
        invoiceDecimalPrecision: currencyPrecision.get(row.invoiceCurrencyCode) ?? 2,
        settlementDecimalPrecision: currencyPrecision.get(row.settlementCurrencyCode) ?? 2,
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
