import type { SystemSettingsRecord } from "@/domain/settings/types";

export function testSystemSettingsRecord(
  overrides: Partial<SystemSettingsRecord> = {},
): SystemSettingsRecord {
  return {
    id: "cccccccc-cccc-4ccc-8ccc-000000000001",
    reportingCurrencyCode: "USD",
    defaultTimezone: "UTC",
    roundingTolerance: "0.01",
    invoiceNumberIncludeYear: false,
    notifyInvoiceEmailSent: true,
    notifyInvoiceEmailFailed: true,
    notifyPaymentSuccess: false,
    notifyPaymentFailed: false,
    notifyInvoiceOverdue: true,
    notifyInvoiceOverdueToAdmin: true,
    notifyInvoiceOverdueToAssignedStaff: true,
    notifyComplianceFlagged: true,
    notifyGatewayFailure: true,
    createdAt: new Date("2026-08-20T00:00:00.000Z"),
    updatedAt: new Date("2026-08-20T00:00:00.000Z"),
    ...overrides,
  };
}
