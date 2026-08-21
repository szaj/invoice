import "server-only";

import type { CustomerNoteRecord } from "@/domain/customers/notes";
import { getPrisma } from "@/server/db/client";

function mapRow(row: {
  id: string;
  customerId: string;
  authorUserId: string;
  body: string;
  visibility: "INTERNAL";
  createdAt: Date;
  author?: { name: string } | null;
}): CustomerNoteRecord {
  return {
    id: row.id,
    customerId: row.customerId,
    authorUserId: row.authorUserId,
    authorName: row.author?.name ?? null,
    body: row.body,
    visibility: row.visibility,
    createdAt: row.createdAt,
  };
}

/**
 * Persistence for internal customer notes (TASK-027).
 * Create/list only — no update/delete.
 */
export class PrismaCustomerNoteStore {
  async listByCustomerId(customerId: string): Promise<CustomerNoteRecord[]> {
    const prisma = getPrisma();
    const rows = await prisma.customerNote.findMany({
      where: { customerId, visibility: "INTERNAL" },
      include: { author: { select: { name: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return rows.map(mapRow);
  }

  async createNote(input: {
    customerId: string;
    authorUserId: string;
    body: string;
  }): Promise<CustomerNoteRecord> {
    const prisma = getPrisma();
    const created = await prisma.customerNote.create({
      data: {
        customerId: input.customerId,
        authorUserId: input.authorUserId,
        body: input.body,
        visibility: "INTERNAL",
      },
      include: { author: { select: { name: true } } },
    });
    return mapRow(created);
  }
}
