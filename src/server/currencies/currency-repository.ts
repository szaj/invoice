import "server-only";

import type { CurrencyRecord, CurrencyStatus } from "@/domain/currencies/types";
import { getPrisma } from "@/server/db/client";

function mapRow(row: {
  id: string;
  code: string;
  name: string;
  symbol: string;
  decimalPrecision: number;
  status: CurrencyStatus;
  createdAt: Date;
  updatedAt: Date;
}): CurrencyRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    symbol: row.symbol,
    decimalPrecision: row.decimalPrecision,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaCurrencyStore {
  async listCurrencies(): Promise<CurrencyRecord[]> {
    const prisma = getPrisma();
    const rows = await prisma.currency.findMany({
      orderBy: [{ code: "asc" }],
    });
    return rows.map(mapRow);
  }

  async getCurrencyById(id: string): Promise<CurrencyRecord | null> {
    const prisma = getPrisma();
    const row = await prisma.currency.findUnique({ where: { id } });
    return row ? mapRow(row) : null;
  }

  async findByCode(code: string): Promise<CurrencyRecord | null> {
    const prisma = getPrisma();
    const row = await prisma.currency.findUnique({ where: { code } });
    return row ? mapRow(row) : null;
  }

  async createCurrency(input: {
    code: string;
    name: string;
    symbol: string;
    decimalPrecision: number;
    status: CurrencyStatus;
  }): Promise<CurrencyRecord> {
    const prisma = getPrisma();
    const created = await prisma.currency.create({
      data: {
        code: input.code,
        name: input.name,
        symbol: input.symbol,
        decimalPrecision: input.decimalPrecision,
        status: input.status,
      },
    });
    return mapRow(created);
  }

  async updateCurrency(
    id: string,
    input: {
      name: string;
      symbol: string;
      decimalPrecision: number;
      status: CurrencyStatus;
    },
  ): Promise<CurrencyRecord> {
    const prisma = getPrisma();
    const updated = await prisma.currency.update({
      where: { id },
      data: {
        name: input.name,
        symbol: input.symbol,
        decimalPrecision: input.decimalPrecision,
        status: input.status,
      },
    });
    return mapRow(updated);
  }

  async setStatus(id: string, status: CurrencyStatus): Promise<CurrencyRecord> {
    const prisma = getPrisma();
    const updated = await prisma.currency.update({
      where: { id },
      data: { status },
    });
    return mapRow(updated);
  }
}
