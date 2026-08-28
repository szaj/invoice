import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { InvoiceHeaderWriteInput } from "@/domain/invoices/schema";
import type { InvoiceLineItemRecord } from "@/domain/invoices/line-items";
import type { InvoiceTotalsResult } from "@/domain/invoices/totals";
import type {
  InvoiceComplianceStatus,
  InvoiceRecord,
  InvoiceStatus,
} from "@/domain/invoices/types";
import type { InvoiceListSortField, ListSortDir } from "@/domain/lists/pagination";
import { getPrisma } from "@/server/db/client";
import { toDecimalString } from "@/domain/money";

type InvoiceRow = {
  id: string;
  companyId: string;
  customerId: string;
  invoiceNumber: string | null;
  invoiceDate: Date;
  dueDate: Date;
  currencyCode: string;
  referencePo: string | null;
  assignedStaffUserId: string | null;
  status: InvoiceStatus;
  complianceStatus: InvoiceComplianceStatus;
  internalNotes: string | null;
  customerNotes: string | null;
  subtotal: { toString(): string };
  discountTotal: { toString(): string };
  taxTotal: { toString(): string };
  invoiceTotal: { toString(): string };
  confirmedPaidAmount: { toString(): string };
  outstandingAmount: { toString(): string };
  cancellationReason: string | null;
  cancelledAt: Date | null;
  cancelledByUserId: string | null;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type InvoiceItemRow = {
  id: string;
  invoiceId: string;
  sortOrder: number;
  description: string;
  quantity: { toString(): string };
  unitRate: { toString(): string };
  taxName: string | null;
  taxRatePercent: { toString(): string } | null;
  lineTotal: { toString(): string };
  createdAt: Date;
  updatedAt: Date;
};

function mapRow(row: InvoiceRow): InvoiceRecord {
  return {
    id: row.id,
    companyId: row.companyId,
    customerId: row.customerId,
    invoiceNumber: row.invoiceNumber,
    invoiceDate: row.invoiceDate,
    dueDate: row.dueDate,
    currencyCode: row.currencyCode.trim(),
    referencePo: row.referencePo,
    assignedStaffUserId: row.assignedStaffUserId,
    status: row.status,
    complianceStatus: row.complianceStatus,
    internalNotes: row.internalNotes,
    customerNotes: row.customerNotes,
    subtotal: toDecimalString(row.subtotal.toString()),
    discountTotal: toDecimalString(row.discountTotal.toString()),
    taxTotal: toDecimalString(row.taxTotal.toString()),
    invoiceTotal: toDecimalString(row.invoiceTotal.toString()),
    confirmedPaidAmount: toDecimalString(row.confirmedPaidAmount.toString()),
    outstandingAmount: toDecimalString(row.outstandingAmount.toString()),
    cancellationReason: row.cancellationReason,
    cancelledAt: row.cancelledAt,
    cancelledByUserId: row.cancelledByUserId,
    createdByUserId: row.createdByUserId,
    updatedByUserId: row.updatedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapLineItemRow(row: InvoiceItemRow): InvoiceLineItemRecord {
  return {
    id: row.id,
    invoiceId: row.invoiceId,
    sortOrder: row.sortOrder,
    description: row.description,
    quantity: toDecimalString(row.quantity.toString()),
    unitRate: toDecimalString(row.unitRate.toString()),
    taxName: row.taxName,
    taxRatePercent:
      row.taxRatePercent != null ? toDecimalString(row.taxRatePercent.toString()) : null,
    lineTotal: toDecimalString(row.lineTotal.toString()),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function totalsWriteData(totals: InvoiceTotalsResult) {
  return {
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxTotal: totals.taxTotal,
    invoiceTotal: totals.invoiceTotal,
    confirmedPaidAmount: totals.confirmedPaidAmount,
    outstandingAmount: totals.outstandingAmount,
  };
}

function invoiceListOrderBy(
  sortBy: InvoiceListSortField,
  sortDir: ListSortDir,
): Prisma.InvoiceOrderByWithRelationInput[] {
  switch (sortBy) {
    case "invoiceDate":
      return [{ invoiceDate: sortDir }, { id: "asc" }];
    case "dueDate":
      return [{ dueDate: sortDir }, { id: "asc" }];
    case "invoiceNumber":
      return [{ invoiceNumber: sortDir }, { id: "asc" }];
    case "status":
      return [{ status: sortDir }, { id: "asc" }];
    case "updatedAt":
    default:
      return [{ updatedAt: sortDir }, { createdAt: sortDir }, { id: "asc" }];
  }
}

/**
 * Internal persistence for invoice headers, line items, and stored totals (TASK-030–034).
 * No hard-delete method for invoices (BR-012 / soft status later).
 */
export class PrismaInvoiceStore {
  async getInvoiceById(id: string): Promise<InvoiceRecord | null> {
    const prisma = getPrisma();
    const row = await prisma.invoice.findUnique({ where: { id } });
    return row ? mapRow(row) : null;
  }

  async listInvoices(filters: {
    readonly companyIds: readonly string[];
    readonly status?: InvoiceStatus;
  }): Promise<InvoiceRecord[]> {
    const prisma = getPrisma();
    if (filters.companyIds.length === 0) {
      return [];
    }
    const rows = await prisma.invoice.findMany({
      where: {
        companyId: { in: [...filters.companyIds] },
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(mapRow);
  }

  /**
   * Server-side paginated invoice list (TASK-098). Staff visibility is applied in SQL.
   */
  async listInvoicesPage(filters: {
    readonly companyIds: readonly string[];
    readonly status?: InvoiceStatus;
    readonly statuses?: readonly InvoiceStatus[];
    readonly outstandingOnly?: boolean;
    readonly q?: string;
    readonly visibleToStaffUserId?: string | null;
    readonly page: number;
    readonly pageSize: number;
    readonly sortBy: InvoiceListSortField;
    readonly sortDir: ListSortDir;
  }): Promise<{ readonly rows: InvoiceRecord[]; readonly totalCount: number }> {
    const prisma = getPrisma();
    if (filters.companyIds.length === 0) {
      return { rows: [], totalCount: 0 };
    }

    const where: Prisma.InvoiceWhereInput = {
      companyId: { in: [...filters.companyIds] },
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.statuses && filters.statuses.length > 0
        ? { status: { in: [...filters.statuses] } }
        : {}),
      ...(filters.outstandingOnly ? { outstandingAmount: { gt: 0 } } : {}),
      ...(filters.q ? { invoiceNumber: { contains: filters.q, mode: "insensitive" } } : {}),
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
    const orderBy = invoiceListOrderBy(filters.sortBy, filters.sortDir);

    const [totalCount, rows] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        orderBy,
        skip,
        take: filters.pageSize,
      }),
    ]);

    return { rows: rows.map(mapRow), totalCount };
  }

  async listLineItems(invoiceId: string): Promise<InvoiceLineItemRecord[]> {
    const prisma = getPrisma();
    const rows = await prisma.invoiceItem.findMany({
      where: { invoiceId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(mapLineItemRow);
  }

  async replaceLineItems(
    invoiceId: string,
    items: readonly {
      readonly sortOrder: number;
      readonly description: string;
      readonly quantity: string;
      readonly unitRate: string;
      readonly taxName: string | null;
      readonly taxRatePercent: string | null;
      readonly lineTotal: string;
    }[],
    totals: InvoiceTotalsResult,
    actor?: { updatedByUserId?: string | null },
  ): Promise<InvoiceLineItemRecord[]> {
    const prisma = getPrisma();
    return prisma.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({ where: { invoiceId } });
      if (items.length > 0) {
        await tx.invoiceItem.createMany({
          data: items.map((item) => ({
            invoiceId,
            sortOrder: item.sortOrder,
            description: item.description,
            quantity: item.quantity,
            unitRate: item.unitRate,
            taxName: item.taxName,
            taxRatePercent: item.taxRatePercent,
            lineTotal: item.lineTotal,
          })),
        });
      }
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          ...totalsWriteData(totals),
          updatedByUserId: actor?.updatedByUserId ?? null,
        },
      });
      const rows = await tx.invoiceItem.findMany({
        where: { invoiceId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });
      return rows.map(mapLineItemRow);
    });
  }

  async updateStoredTotals(
    invoiceId: string,
    totals: InvoiceTotalsResult,
    actor?: { updatedByUserId?: string | null },
  ): Promise<InvoiceRecord> {
    const prisma = getPrisma();
    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        ...totalsWriteData(totals),
        updatedByUserId: actor?.updatedByUserId ?? null,
      },
    });
    return mapRow(updated);
  }

  /**
   * Persist BR-009 paid/outstanding + payment-derived status (TASK-060).
   * Does not rewrite line-item totals or invent a manually edited paid total.
   */
  async updatePaymentAllocation(
    invoiceId: string,
    input: {
      readonly confirmedPaidAmount: string;
      readonly outstandingAmount: string;
      readonly status: InvoiceStatus;
    },
    actor?: { updatedByUserId?: string | null },
  ): Promise<InvoiceRecord> {
    const prisma = getPrisma();
    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        confirmedPaidAmount: input.confirmedPaidAmount,
        outstandingAmount: input.outstandingAmount,
        status: input.status,
        updatedByUserId: actor?.updatedByUserId ?? null,
      },
    });
    return mapRow(updated);
  }

  async updateInvoiceStatus(
    id: string,
    status: InvoiceStatus,
    actor?: { updatedByUserId?: string | null },
  ): Promise<InvoiceRecord> {
    const prisma = getPrisma();
    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status,
        updatedByUserId: actor?.updatedByUserId ?? null,
      },
    });
    return mapRow(updated);
  }

  /**
   * Soft-cancel: status + reason only. Does not rewrite financial totals or delete versions.
   */
  async cancelInvoice(
    id: string,
    input: {
      readonly reason: string;
      readonly cancelledAt: Date;
      readonly cancelledByUserId: string;
    },
  ): Promise<InvoiceRecord> {
    const prisma = getPrisma();
    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancellationReason: input.reason,
        cancelledAt: input.cancelledAt,
        cancelledByUserId: input.cancelledByUserId,
        updatedByUserId: input.cancelledByUserId,
      },
    });
    return mapRow(updated);
  }

  async createInvoice(
    input: InvoiceHeaderWriteInput,
    actor?: { createdByUserId?: string | null },
  ): Promise<InvoiceRecord> {
    const prisma = getPrisma();
    const created = await prisma.invoice.create({
      data: {
        companyId: input.companyId,
        customerId: input.customerId,
        invoiceNumber: input.invoiceNumber,
        invoiceDate: input.invoiceDate,
        dueDate: input.dueDate,
        currencyCode: input.currencyCode,
        referencePo: input.referencePo,
        assignedStaffUserId: input.assignedStaffUserId,
        status: input.status,
        complianceStatus: input.complianceStatus,
        internalNotes: input.internalNotes,
        customerNotes: input.customerNotes,
        subtotal: "0",
        discountTotal: "0",
        taxTotal: "0",
        invoiceTotal: "0",
        confirmedPaidAmount: "0",
        outstandingAmount: "0",
        createdByUserId: actor?.createdByUserId ?? null,
        updatedByUserId: actor?.createdByUserId ?? null,
      },
    });
    return mapRow(created);
  }

  async updateInvoice(
    id: string,
    input: InvoiceHeaderWriteInput,
    actor?: { updatedByUserId?: string | null },
  ): Promise<InvoiceRecord> {
    const prisma = getPrisma();
    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        companyId: input.companyId,
        customerId: input.customerId,
        invoiceNumber: input.invoiceNumber,
        invoiceDate: input.invoiceDate,
        dueDate: input.dueDate,
        currencyCode: input.currencyCode,
        referencePo: input.referencePo,
        assignedStaffUserId: input.assignedStaffUserId,
        status: input.status,
        complianceStatus: input.complianceStatus,
        internalNotes: input.internalNotes,
        customerNotes: input.customerNotes,
        updatedByUserId: actor?.updatedByUserId ?? null,
      },
    });
    return mapRow(updated);
  }
}
