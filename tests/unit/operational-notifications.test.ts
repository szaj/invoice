import { describe, expect, it, vi } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import {
  isOperationalNotificationEnabled,
  overdueRecipientFlags,
} from "@/domain/notifications/settings";
import { buildOperationalNotificationContent } from "@/domain/notifications/templates";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@/domain/notifications/types";
import type { SystemSettingsRecord } from "@/domain/settings/types";
import { EmailService } from "@/server/email/email-service";
import { MemoryEmailProvider } from "@/server/email/memory-email-provider";
import { OperationalNotificationService } from "@/server/notifications/notification-service";

const { emitOperationalNotificationMock } = vi.hoisted(() => ({
  emitOperationalNotificationMock: vi.fn(),
}));

vi.mock("@/server/notifications/notification-service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/server/notifications/notification-service")>();
  return {
    ...actual,
    emitOperationalNotification: emitOperationalNotificationMock,
  };
});

import { updateComplianceStatus } from "@/server/compliance/compliance-service";

function settingsRecord(overrides: Partial<SystemSettingsRecord> = {}): SystemSettingsRecord {
  return {
    id: "cccccccc-cccc-4ccc-8ccc-000000000001",
    reportingCurrencyCode: "USD",
    defaultTimezone: "UTC",
    roundingTolerance: "0",
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

describe("operational notification settings (TASK-091)", () => {
  it("respects per-kind enable flags", () => {
    expect(
      isOperationalNotificationEnabled(
        "PAYMENT_SUCCESS",
        settingsRecord({ notifyPaymentSuccess: false }),
      ),
    ).toBe(false);
    expect(
      isOperationalNotificationEnabled(
        "COMPLIANCE_FLAGGED",
        settingsRecord({ notifyComplianceFlagged: true }),
      ),
    ).toBe(true);
  });

  it("derives overdue recipient toggles from master flag", () => {
    expect(overdueRecipientFlags(DEFAULT_NOTIFICATION_SETTINGS)).toEqual({
      notifyAdmin: true,
      notifyAssignedStaff: true,
    });
    expect(overdueRecipientFlags(settingsRecord({ notifyInvoiceOverdue: false }))).toEqual({
      notifyAdmin: false,
      notifyAssignedStaff: false,
    });
  });
});

describe("operational notification templates (TASK-091)", () => {
  it("builds compliance flagged content with reason and notes", () => {
    const content = buildOperationalNotificationContent({
      kind: "COMPLIANCE_FLAGGED",
      companyId: "22222222-2222-4222-8222-222222222222",
      subjectType: "INVOICE",
      subjectId: "33333333-3333-4333-8333-333333333333",
      subjectLabel: "INV-100",
      status: "FLAGGED",
      reason: "SUSPICIOUS_AMOUNT",
      notes: "Amount unusual",
    });

    expect(content.subject).toContain("INV-100");
    expect(content.text).toContain("SUSPICIOUS_AMOUNT");
    expect(content.text).toContain("Amount unusual");
  });
});

describe("OperationalNotificationService", () => {
  it("sends compliance flagged alerts to Admin and assigned Compliance users", async () => {
    const memoryEmail = new MemoryEmailProvider();
    const service = new OperationalNotificationService({
      settings: {
        getSettings: async () => settingsRecord(),
      },
      recipients: {
        listActiveAdminEmails: async () => ["admin@example.com"],
        listActiveComplianceEmailsForCompany: async () => ["compliance@example.com"],
        getActiveUserEmail: async () => null,
        isUserAssignedToCompany: async () => false,
      },
      emailService: new EmailService(memoryEmail, "noreply@localhost.test"),
    });

    await service.emit({
      kind: "COMPLIANCE_FLAGGED",
      companyId: "22222222-2222-4222-8222-222222222222",
      subjectType: "INVOICE",
      subjectId: "33333333-3333-4333-8333-333333333333",
      subjectLabel: "INV-100",
      status: "FLAGGED",
      reason: "SUSPICIOUS_AMOUNT",
      notes: null,
    });

    expect(memoryEmail.sent).toHaveLength(2);
    expect(memoryEmail.sent.map((row) => row.to).sort()).toEqual([
      "admin@example.com",
      "compliance@example.com",
    ]);
  });

  it("skips optional payment notifications when disabled", async () => {
    const memoryEmail = new MemoryEmailProvider();
    const service = new OperationalNotificationService({
      settings: {
        getSettings: async () => settingsRecord({ notifyPaymentSuccess: false }),
      },
      recipients: {
        listActiveAdminEmails: async () => ["admin@example.com"],
        listActiveComplianceEmailsForCompany: async () => [],
        getActiveUserEmail: async () => null,
        isUserAssignedToCompany: async () => false,
      },
      emailService: new EmailService(memoryEmail, "noreply@localhost.test"),
    });

    await service.emit({
      kind: "PAYMENT_SUCCESS",
      companyId: "22222222-2222-4222-8222-222222222222",
      paymentId: "44444444-4444-4444-8444-444444444444",
      invoiceId: "33333333-3333-4333-8333-333333333333",
      invoiceNumber: "INV-100",
      amount: "50.00",
      currencyCode: "USD",
      methodCode: "MANUAL",
    });

    expect(memoryEmail.sent).toHaveLength(0);
  });
});

describe("compliance status notification hook (TASK-091)", () => {
  const companyId = "22222222-2222-4222-8222-222222222222";
  const invoiceId = "33333333-3333-4333-8333-333333333333";

  function principal(roleCode: "ADMIN" | "COMPLIANCE"): AuthorizationPrincipal {
    return {
      userId: "11111111-1111-4111-8111-111111111111",
      status: "ACTIVE",
      roleCode,
      assignedCompanyIds: roleCode === "COMPLIANCE" ? [companyId] : [],
    };
  }

  it("emits when status transitions to FLAGGED", async () => {
    emitOperationalNotificationMock.mockClear();
    const append = vi.fn().mockResolvedValue({ id: "audit" });

    const result = await updateComplianceStatus(
      principal("COMPLIANCE"),
      {
        subjectType: "INVOICE",
        subjectId: invoiceId,
        status: "FLAGGED",
        reason: "SUSPICIOUS_AMOUNT",
      },
      {
        store: {
          createReview: vi.fn().mockResolvedValue({
            id: "66666666-6666-4666-8666-666666666666",
            companyId,
            subjectType: "INVOICE",
            subjectId: invoiceId,
            status: "FLAGGED",
            notes: null,
            reason: "SUSPICIOUS_AMOUNT",
            resolutionNotes: null,
            evidenceRefs: null,
            reviewerUserId: principal("COMPLIANCE").userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
          listReviews: vi.fn(),
          updateInvoiceComplianceStatus: vi.fn(),
          updatePaymentComplianceStatus: vi.fn(),
          updateCustomerComplianceStatus: vi.fn(),
          listQueue: vi.fn(),
        },
        invoices: {
          getInvoiceById: vi.fn().mockResolvedValue({
            id: invoiceId,
            companyId,
            customerId: "55555555-5555-4555-8555-555555555555",
            invoiceNumber: "INV-100",
            invoiceDate: new Date(),
            dueDate: new Date(),
            currencyCode: "USD",
            referencePo: null,
            assignedStaffUserId: null,
            status: "ISSUED",
            complianceStatus: "UNDER_REVIEW",
            internalNotes: null,
            customerNotes: null,
            subtotal: "10.0000",
            discountTotal: "0.0000",
            taxTotal: "0.0000",
            invoiceTotal: "10.0000",
            confirmedPaidAmount: "0.0000",
            outstandingAmount: "10.0000",
            cancellationReason: null,
            cancelledAt: null,
            cancelledByUserId: null,
            createdByUserId: null,
            updatedByUserId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
        payments: { getPaymentById: vi.fn() },
        customers: { getCustomerById: vi.fn() },
        auditWriter: { append },
        enforceTransactionalCompanyScope: async () => ({ ok: true as const, data: true as const }),
      },
    );

    expect(result.ok).toBe(true);
    expect(emitOperationalNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "COMPLIANCE_FLAGGED",
        companyId,
        subjectId: invoiceId,
        reason: "SUSPICIOUS_AMOUNT",
      }),
    );
  });
});
