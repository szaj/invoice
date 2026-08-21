import "server-only";

import {
  INVOICE_PDF_CONTENT_TYPE,
  type InvoicePdfFileRecord,
  type InvoicePdfPageSize,
} from "@/domain/invoices/pdf";
import { getPrisma } from "@/server/db/client";

function mapRow(row: {
  id: string;
  invoiceId: string;
  invoiceVersionId: string;
  storageKey: string;
  checksumSha256: string;
  byteSize: number;
  contentType: string;
  pageSize: string;
  createdByUserId: string | null;
  createdAt: Date;
}): InvoicePdfFileRecord {
  return {
    id: row.id,
    invoiceId: row.invoiceId,
    invoiceVersionId: row.invoiceVersionId,
    storageKey: row.storageKey,
    checksumSha256: row.checksumSha256,
    byteSize: row.byteSize,
    contentType: row.contentType,
    pageSize: row.pageSize as InvoicePdfPageSize,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
  };
}

export class PrismaInvoiceFileStore {
  async getById(id: string): Promise<InvoicePdfFileRecord | null> {
    const prisma = getPrisma();
    const row = await prisma.invoiceFile.findUnique({ where: { id } });
    return row ? mapRow(row) : null;
  }

  async getByInvoiceVersionId(invoiceVersionId: string): Promise<InvoicePdfFileRecord | null> {
    const prisma = getPrisma();
    const row = await prisma.invoiceFile.findUnique({ where: { invoiceVersionId } });
    return row ? mapRow(row) : null;
  }

  async listByInvoiceId(invoiceId: string): Promise<InvoicePdfFileRecord[]> {
    const prisma = getPrisma();
    const rows = await prisma.invoiceFile.findMany({
      where: { invoiceId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapRow);
  }

  async createFile(input: {
    readonly invoiceId: string;
    readonly invoiceVersionId: string;
    readonly storageKey: string;
    readonly checksumSha256: string;
    readonly byteSize: number;
    readonly pageSize: InvoicePdfPageSize;
    readonly createdByUserId: string | null;
  }): Promise<InvoicePdfFileRecord> {
    const prisma = getPrisma();
    const created = await prisma.invoiceFile.create({
      data: {
        invoiceId: input.invoiceId,
        invoiceVersionId: input.invoiceVersionId,
        storageKey: input.storageKey,
        checksumSha256: input.checksumSha256,
        byteSize: input.byteSize,
        contentType: INVOICE_PDF_CONTENT_TYPE,
        pageSize: input.pageSize,
        createdByUserId: input.createdByUserId,
      },
    });
    return mapRow(created);
  }
}
