import "server-only";

import { toDecimalString } from "@/domain/money/decimal";
import type { CustomerFinancialSummaryInvoiceInput } from "@/domain/customers/financial-summary";
import { isCollectibleInvoiceStatus } from "@/domain/invoices/cancellation";
import type { InvoiceStatus } from "@/domain/invoices/types";
import { getPrisma } from "@/server/db/client";
import type { CustomerFinancialSummarySource } from "@/server/customers/customer-financial-summary-source";

/**
 * Prisma-backed invoice feed for customer financial summary (TASK-038 / BR-019).
 * Cancelled invoices are excluded from collectible outstanding (and all summary metrics).
 * Confirmed payment applications are empty until payment modules exist.
 */
export class PrismaCustomerFinancialSummarySource implements CustomerFinancialSummarySource {
  readonly available = true;

  async listInvoiceRowsForCustomer(input: {
    readonly customerId: string;
    readonly authorizedCompanyIds: readonly string[];
  }): Promise<readonly CustomerFinancialSummaryInvoiceInput[]> {
    if (input.authorizedCompanyIds.length === 0) {
      return [];
    }

    const prisma = getPrisma();
    const rows = await prisma.invoice.findMany({
      where: {
        customerId: input.customerId,
        companyId: { in: [...input.authorizedCompanyIds] },
      },
      select: {
        companyId: true,
        currencyCode: true,
        invoiceTotal: true,
        dueDate: true,
        status: true,
      },
    });

    const currencyCodes = [...new Set(rows.map((row) => row.currencyCode))];
    const currencies =
      currencyCodes.length === 0
        ? []
        : await prisma.currency.findMany({
            where: { code: { in: currencyCodes } },
            select: { code: true, decimalPrecision: true },
          });
    const precisionByCode = new Map(currencies.map((c) => [c.code, c.decimalPrecision]));

    return rows.map((row) => {
      const status = row.status as InvoiceStatus;
      const cancelled = status === "CANCELLED";
      return {
        companyId: row.companyId,
        currencyCode: row.currencyCode,
        invoiceTotal: toDecimalString(row.invoiceTotal.toString()),
        confirmedApplications: [],
        dueDate: row.dueDate,
        cancelled,
        includeInSummary: isCollectibleInvoiceStatus(status),
        decimalPrecision: precisionByCode.get(row.currencyCode) ?? 2,
      };
    });
  }
}
