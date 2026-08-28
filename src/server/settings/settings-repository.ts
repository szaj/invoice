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
  invoiceNumberIncludeYear: boolean;
  notifyInvoiceEmailSent: boolean;
  notifyInvoiceEmailFailed: boolean;
  notifyPaymentSuccess: boolean;
  notifyPaymentFailed: boolean;
  notifyInvoiceOverdue: boolean;
  notifyInvoiceOverdueToAdmin: boolean;
  notifyInvoiceOverdueToAssignedStaff: boolean;
  notifyComplianceFlagged: boolean;
  notifyGatewayFailure: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SystemSettingsRecord {
  return {
    id: row.id,
    reportingCurrencyCode: row.reportingCurrencyCode,
    defaultTimezone: row.defaultTimezone,
    roundingTolerance: row.roundingTolerance.toString(),
    invoiceNumberIncludeYear: row.invoiceNumberIncludeYear,
    notifyInvoiceEmailSent: row.notifyInvoiceEmailSent,
    notifyInvoiceEmailFailed: row.notifyInvoiceEmailFailed,
    notifyPaymentSuccess: row.notifyPaymentSuccess,
    notifyPaymentFailed: row.notifyPaymentFailed,
    notifyInvoiceOverdue: row.notifyInvoiceOverdue,
    notifyInvoiceOverdueToAdmin: row.notifyInvoiceOverdueToAdmin,
    notifyInvoiceOverdueToAssignedStaff: row.notifyInvoiceOverdueToAssignedStaff,
    notifyComplianceFlagged: row.notifyComplianceFlagged,
    notifyGatewayFailure: row.notifyGatewayFailure,
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
    invoiceNumberIncludeYear: boolean;
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
        invoiceNumberIncludeYear: input.invoiceNumberIncludeYear,
      },
    });
    return mapRow(updated);
  }

  async updateNotificationSettings(input: {
    notifyInvoiceEmailSent: boolean;
    notifyInvoiceEmailFailed: boolean;
    notifyPaymentSuccess: boolean;
    notifyPaymentFailed: boolean;
    notifyInvoiceOverdue: boolean;
    notifyInvoiceOverdueToAdmin: boolean;
    notifyInvoiceOverdueToAssignedStaff: boolean;
    notifyComplianceFlagged: boolean;
    notifyGatewayFailure: boolean;
  }): Promise<SystemSettingsRecord> {
    const prisma = getPrisma();
    const existing = await this.getSettings();
    if (!existing) {
      throw new Error("SYSTEM_SETTINGS_MISSING");
    }

    const updated = await prisma.systemSettings.update({
      where: { id: existing.id },
      data: input,
    });
    return mapRow(updated);
  }
}
