import "server-only";

import { Prisma } from "@/generated/prisma/client";

import type { SystemSettingsRecord } from "@/domain/settings/types";
import { SYSTEM_SETTINGS_SINGLETON_ID } from "@/domain/settings/types";
import { getPrisma } from "@/server/db/client";

function mapRow(row: {
  id: string;
  reportingCurrencyCode: string;
  defaultTimezone: string;
  roundingTolerance: Prisma.Decimal;
  createdAt: Date;
  updatedAt: Date;
}): SystemSettingsRecord {
  return {
    id: row.id,
    reportingCurrencyCode: row.reportingCurrencyCode,
    defaultTimezone: row.defaultTimezone,
    roundingTolerance: row.roundingTolerance.toString(),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaSystemSettingsStore {
  async getSettings(): Promise<SystemSettingsRecord | null> {
    const prisma = getPrisma();
    const row =
      (await prisma.systemSettings.findUnique({
        where: { id: SYSTEM_SETTINGS_SINGLETON_ID },
      })) ?? (await prisma.systemSettings.findFirst({ orderBy: { createdAt: "asc" } }));
    return row ? mapRow(row) : null;
  }

  async updateSettings(input: {
    reportingCurrencyCode: string;
    defaultTimezone: string;
    roundingTolerance: string;
  }): Promise<SystemSettingsRecord> {
    const prisma = getPrisma();
    const existing = await this.getSettings();
    if (!existing) {
      throw new Error("SYSTEM_SETTINGS_MISSING");
    }

    const updated = await prisma.systemSettings.update({
      where: { id: existing.id },
      data: {
        reportingCurrencyCode: input.reportingCurrencyCode,
        defaultTimezone: input.defaultTimezone,
        roundingTolerance: new Prisma.Decimal(input.roundingTolerance),
      },
    });
    return mapRow(updated);
  }
}
