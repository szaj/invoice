import "server-only";

import type { Prisma } from "@/generated/prisma/client";

import { type InvoiceVersionRecord, type InvoiceVersionSnapshot } from "@/domain/invoices/versions";
import { getPrisma } from "@/server/db/client";

function mapSnapshot(value: Prisma.JsonValue): InvoiceVersionSnapshot {
  return value as unknown as InvoiceVersionSnapshot;
}

function mapRow(row: {
  id: string;
  invoiceId: string;
  versionNo: number;
  snapshot: Prisma.JsonValue;
  reason: string | null;
  createdByUserId: string | null;
  createdAt: Date;
}): InvoiceVersionRecord {
  return {
    id: row.id,
    invoiceId: row.invoiceId,
    versionNo: row.versionNo,
    snapshot: mapSnapshot(row.snapshot),
    reason: row.reason,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
  };
}

export class PrismaInvoiceVersionStore {
  async listByInvoiceId(invoiceId: string): Promise<InvoiceVersionRecord[]> {
    const prisma = getPrisma();
    const rows = await prisma.invoiceVersion.findMany({
      where: { invoiceId },
      orderBy: [{ versionNo: "desc" }],
    });
    return rows.map(mapRow);
  }

  async getNextVersionNo(invoiceId: string): Promise<number> {
    const prisma = getPrisma();
    const latest = await prisma.invoiceVersion.findFirst({
      where: { invoiceId },
      orderBy: { versionNo: "desc" },
      select: { versionNo: true },
    });
    return (latest?.versionNo ?? 0) + 1;
  }

  /**
   * Append-only create. Never updates existing version rows.
   */
  async createVersion(input: {
    readonly invoiceId: string;
    readonly versionNo: number;
    readonly snapshot: InvoiceVersionSnapshot;
    readonly reason: string | null;
    readonly createdByUserId: string | null;
  }): Promise<InvoiceVersionRecord> {
    const prisma = getPrisma();
    const created = await prisma.invoiceVersion.create({
      data: {
        invoiceId: input.invoiceId,
        versionNo: input.versionNo,
        snapshot: input.snapshot as unknown as Prisma.InputJsonValue,
        reason: input.reason,
        createdByUserId: input.createdByUserId,
      },
    });
    return mapRow(created);
  }
}
