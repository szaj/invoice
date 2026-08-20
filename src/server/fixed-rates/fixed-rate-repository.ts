import "server-only";

import { Prisma } from "@/generated/prisma/client";

import type { FixedConversionRateRecord } from "@/domain/fixed-rates/types";
import { getPrisma } from "@/server/db/client";

function toRecord(row: {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  fixedRate: Prisma.Decimal;
  versionNo: number;
  frequencyLabel: FixedConversionRateRecord["frequencyLabel"];
  validFrom: Date;
  validTo: Date | null;
  status: FixedConversionRateRecord["status"];
  notes: string | null;
  createdByUserId: string | null;
  createdAt: Date;
}): FixedConversionRateRecord {
  return {
    id: row.id,
    fromCurrency: row.fromCurrency,
    toCurrency: row.toCurrency,
    fixedRate: row.fixedRate.toFixed(12),
    versionNo: row.versionNo,
    frequencyLabel: row.frequencyLabel,
    validFrom: row.validFrom,
    validTo: row.validTo,
    status: row.status,
    notes: row.notes,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
  };
}

export type CreateFixedRateInput = {
  fromCurrency: string;
  toCurrency: string;
  fixedRate: string;
  versionNo: number;
  frequencyLabel: FixedConversionRateRecord["frequencyLabel"];
  validFrom: Date;
  validTo: Date | null;
  notes: string | null;
  createdByUserId: string | null;
};

export type CreateVersionResult = {
  readonly created: FixedConversionRateRecord;
  readonly expired: readonly FixedConversionRateRecord[];
};

export class PrismaFixedConversionRateStore {
  async findCurrencyCodes(codes: readonly string[]): Promise<string[]> {
    if (codes.length === 0) {
      return [];
    }
    const prisma = getPrisma();
    const rows = await prisma.currency.findMany({
      where: { code: { in: [...codes] } },
      select: { code: true },
    });
    return rows.map((row) => row.code);
  }

  async nextVersionNo(fromCurrency: string, toCurrency: string): Promise<number> {
    const prisma = getPrisma();
    const latest = await prisma.fixedConversionRate.findFirst({
      where: { fromCurrency, toCurrency },
      orderBy: { versionNo: "desc" },
      select: { versionNo: true },
    });
    return (latest?.versionNo ?? 0) + 1;
  }

  async listRates(filter?: {
    fromCurrency?: string;
    toCurrency?: string;
  }): Promise<FixedConversionRateRecord[]> {
    const prisma = getPrisma();
    const rows = await prisma.fixedConversionRate.findMany({
      where: {
        ...(filter?.fromCurrency ? { fromCurrency: filter.fromCurrency } : {}),
        ...(filter?.toCurrency ? { toCurrency: filter.toCurrency } : {}),
      },
      orderBy: [{ fromCurrency: "asc" }, { toCurrency: "asc" }, { versionNo: "desc" }],
    });
    return rows.map(toRecord);
  }

  /** Read model for effective-rate selection (TASK-018): all versions for a pair. */
  async listRatesForPair(
    fromCurrency: string,
    toCurrency: string,
  ): Promise<FixedConversionRateRecord[]> {
    return this.listRates({ fromCurrency, toCurrency });
  }

  /**
   * Append-only create: inserts a new version and expires prior ACTIVE versions
   * for the same pair. Does not mutate fixed_rate on historical rows.
   */
  async createVersionAndExpirePrevious(input: CreateFixedRateInput): Promise<CreateVersionResult> {
    const prisma = getPrisma();

    return prisma.$transaction(async (tx) => {
      const previousActive = await tx.fixedConversionRate.findMany({
        where: {
          fromCurrency: input.fromCurrency,
          toCurrency: input.toCurrency,
          status: "ACTIVE",
        },
        orderBy: { versionNo: "asc" },
      });

      const expired: FixedConversionRateRecord[] = [];
      for (const prior of previousActive) {
        const closedValidTo =
          prior.validTo && prior.validTo.getTime() <= input.validFrom.getTime()
            ? prior.validTo
            : input.validFrom;

        const updated = await tx.fixedConversionRate.update({
          where: { id: prior.id },
          data: {
            status: "EXPIRED",
            validTo: closedValidTo,
          },
        });
        expired.push(toRecord(updated));
      }

      const created = await tx.fixedConversionRate.create({
        data: {
          fromCurrency: input.fromCurrency,
          toCurrency: input.toCurrency,
          fixedRate: new Prisma.Decimal(input.fixedRate),
          versionNo: input.versionNo,
          frequencyLabel: input.frequencyLabel,
          validFrom: input.validFrom,
          validTo: input.validTo,
          status: "ACTIVE",
          notes: input.notes,
          createdByUserId: input.createdByUserId,
        },
      });

      return {
        created: toRecord(created),
        expired,
      };
    });
  }
}
