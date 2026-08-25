import { describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import {
  INVOICE_EMAIL_CUSTOMER_REQUIRED,
  INVOICE_EMAIL_CC_FORBIDDEN,
  INVOICE_EMAIL_FORBIDDEN,
  INVOICE_EMAIL_PDF_REQUIRED,
  INVOICE_EMAIL_SEND_FAILED,
} from "@/domain/invoices/email";
import type { InvoiceRecord } from "@/domain/invoices/types";
import type { InvoiceVersionRecord } from "@/domain/invoices/versions";
import { EmailService } from "@/server/email/email-service";
import { MemoryEmailProvider } from "@/server/email/memory-email-provider";
import { sendInvoiceEmail } from "@/server/invoices/invoice-email-service";
import { MemoryStorageService } from "@/server/storage/memory-storage";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const INVOICE_ID = "eeeeeeee-eeee-4eee-8eee-000000000041";
const FILE_ID = "ffffffff-ffff-4fff-8fff-000000000041";
const VERSION_ID = "dddddddd-dddd-4ddd-8ddd-000000000041";
const ADMIN_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const STAFF_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_STAFF = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CUSTOMER_ID = "dddddddd-dddd-4ddd-8ddd-000000000001";

function invoiceRecord(overrides: Partial<InvoiceRecord> = {}): InvoiceRecord {
  return {
    id: INVOICE_ID,
    companyId: COMPANY_A,
    customerId: CUSTOMER_ID,
    invoiceNumber: "DL-000041",
    invoiceDate: new Date("2026-08-01T00:00:00.000Z"),
    dueDate: new Date("2026-09-01T00:00:00.000Z"),
    currencyCode: "USD",
    referencePo: null,
    assignedStaffUserId: STAFF_ID,
    status: "ISSUED",
    complianceStatus: "NOT_REVIEWED",
    internalNotes: "secret",
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
    createdByUserId: STAFF_ID,
    updatedByUserId: STAFF_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function versionRecord(): InvoiceVersionRecord {
  return {
    id: VERSION_ID,
    invoiceId: INVOICE_ID,
    versionNo: 1,
    reason: "Issued",
    createdByUserId: STAFF_ID,
    createdAt: new Date(),
    snapshot: {
      invoiceId: INVOICE_ID,
      companyId: COMPANY_A,
      customerId: CUSTOMER_ID,
      invoiceNumber: "DL-000041",
      invoiceDate: "2026-08-01",
      dueDate: "2026-09-01",
      currencyCode: "USD",
      referencePo: null,
      assignedStaffUserId: STAFF_ID,
      status: "ISSUED",
      complianceStatus: "NOT_REVIEWED",
      internalNotes: "secret",
      customerNotes: null,
      subtotal: "10.0000",
      discountTotal: "0.0000",
      taxTotal: "0.0000",
      invoiceTotal: "10.0000",
      confirmedPaidAmount: "0.0000",
      outstandingAmount: "10.0000",
      lineItems: [],
    },
  };
}

describe("invoice email delivery (TASK-041)", () => {
  it("blocks missing customer email, attaches stored PDF, and logs Failed without un-issuing", async () => {
    const storage = new MemoryStorageService();
    const storageKey = `companies/${COMPANY_A}/invoices/${INVOICE_ID}/v1.pdf`;
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
    await storage.putObject({
      key: storageKey,
      body: pdfBytes,
      contentType: "application/pdf",
    });

    const file = {
      id: FILE_ID,
      invoiceId: INVOICE_ID,
      invoiceVersionId: VERSION_ID,
      storageKey,
      checksumSha256: "a".repeat(64),
      byteSize: pdfBytes.byteLength,
      contentType: "application/pdf",
      pageSize: "A4" as const,
      createdByUserId: ADMIN_ID,
      createdAt: new Date(),
    };

    const emailLogs: Array<Record<string, unknown>> = [];
    const memoryEmail = new MemoryEmailProvider();
    const emailService = new EmailService(memoryEmail, "noreply@test.local");

    const baseDeps = {
      invoices: {
        getInvoiceById: async () => invoiceRecord(),
      },
      versions: {
        listByInvoiceId: async () => [versionRecord()],
      },
      files: {
        getById: async (id: string) => (id === FILE_ID ? file : null),
        listByInvoiceId: async () => [file],
      },
      customers: {
        getCustomerById: async () => ({
          id: CUSTOMER_ID,
          displayName: "Jane Customer",
          contactPerson: null,
          customerType: "INDIVIDUAL" as const,
          email: "jane@example.com",
          phone: null,
          alternatePhone: null,
          addressLine1: null,
          addressLine2: null,
          city: null,
          region: null,
          postalCode: null,
          countryCode: null,
          taxRegistrationId: null,
          website: null,
          defaultInvoiceCurrencyCode: null,
          defaultCompanyId: COMPANY_A,
          paymentPreference: null,
          status: "ACTIVE" as const,
          complianceStatus: "NOT_REVIEWED" as const,
          assignedStaffUserId: STAFF_ID,
          internalNotes: null,
          tags: [] as string[],
          companyIds: [COMPANY_A] as string[],
          createdByUserId: ADMIN_ID,
          updatedByUserId: ADMIN_ID,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
      companies: {
        getCompanyById: async () => ({
          id: COMPANY_A,
          displayName: "Demo Co",
          legalName: null,
          email: "billing@demo.test",
          phone: null,
          website: null,
          registrationTaxNumber: null,
          addressLine1: null,
          addressLine2: null,
          city: null,
          region: null,
          postalCode: null,
          countryCode: "US",
          status: "ACTIVE" as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
      branding: {
        getBrandingByCompanyId: async () => ({
          companyId: COMPANY_A,
          displayName: "Demo Co",
          email: "billing@demo.test",
          phone: "+1 555",
          website: null,
          invoicePrefix: "DL",
          termsAndConditions: null,
          emailTemplateReference: "brand-a",
          logo: null,
          updatedAt: new Date(),
        }),
      },
      emailLogs: {
        create: async (input: Record<string, unknown>) => {
          const row = {
            id: `log-${emailLogs.length + 1}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...input,
          };
          emailLogs.push(row);
          return row as never;
        },
        listByInvoiceId: async () => emailLogs as never,
      },
      storage,
      emailService,
      auditWriter: {
        append: async () =>
          ({
            id: "audit-1",
            occurredAt: new Date(),
            actorType: "USER" as const,
            actorUserId: ADMIN_ID,
            companyId: COMPANY_A,
            entityType: "invoice",
            entityId: INVOICE_ID,
            action: "invoices.emailed",
            oldValues: null,
            newValues: null,
            reason: null,
            requestId: null,
            ipAddress: null,
            userAgent: null,
          }) as never,
      },
    };

    const admin: AuthorizationPrincipal = {
      userId: ADMIN_ID,
      status: "ACTIVE",
      roleCode: "ADMIN",
    };

    const noEmailCustomerDeps = {
      ...baseDeps,
      customers: {
        getCustomerById: async () => ({
          ...(await baseDeps.customers.getCustomerById()),
          email: null,
        }),
      },
    };
    const blocked = await sendInvoiceEmail(admin, INVOICE_ID, {}, noEmailCustomerDeps);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.error).toBe(INVOICE_EMAIL_CUSTOMER_REQUIRED);
    }
    expect(memoryEmail.sent).toHaveLength(0);
    expect(emailLogs).toHaveLength(0);

    const missingBlobDeps = {
      ...baseDeps,
      storage: new MemoryStorageService(),
    };
    const missingPdf = await sendInvoiceEmail(admin, INVOICE_ID, {}, missingBlobDeps);
    expect(missingPdf.ok).toBe(false);
    if (!missingPdf.ok) {
      expect(missingPdf.error).toBe(INVOICE_EMAIL_PDF_REQUIRED);
    }
    expect(memoryEmail.sent).toHaveLength(0);

    const sent = await sendInvoiceEmail(
      admin,
      INVOICE_ID,
      { paymentLink: "https://pay.test/1" },
      baseDeps,
    );
    expect(sent.ok).toBe(true);
    expect(memoryEmail.sent).toHaveLength(1);
    expect(memoryEmail.sent[0]?.to).toBe("jane@example.com");
    expect(memoryEmail.sent[0]?.replyTo).toBe("billing@demo.test");
    expect(memoryEmail.sent[0]?.attachments?.[0]?.content).toEqual(pdfBytes);
    expect(emailLogs).toHaveLength(1);
    expect(emailLogs[0]?.status).toBe("SENT");
    expect(emailLogs[0]?.providerMessageId).toBe("memory-1");

    memoryEmail.failNextWith = "provider down";
    const failed = await sendInvoiceEmail(admin, INVOICE_ID, {}, baseDeps);
    expect(failed.ok).toBe(false);
    if (!failed.ok) {
      expect(failed.error).toBe(INVOICE_EMAIL_SEND_FAILED);
    }
    expect(emailLogs).toHaveLength(2);
    expect(emailLogs[1]?.status).toBe("FAILED");
    expect(emailLogs[1]?.retryable).toBe(true);

    const otherStaff: AuthorizationPrincipal = {
      userId: OTHER_STAFF,
      status: "ACTIVE",
      roleCode: "STAFF",
      assignedCompanyIds: [COMPANY_A],
    };
    const forbidden = await sendInvoiceEmail(otherStaff, INVOICE_ID, {}, baseDeps);
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) {
      expect(forbidden.error).toBe(INVOICE_EMAIL_FORBIDDEN);
    }

    const assignedStaff: AuthorizationPrincipal = {
      userId: STAFF_ID,
      status: "ACTIVE",
      roleCode: "STAFF",
      assignedCompanyIds: [COMPANY_A],
    };
    const staffCcDenied = await sendInvoiceEmail(
      assignedStaff,
      INVOICE_ID,
      { cc: ["extra@example.com"] },
      baseDeps,
    );
    expect(staffCcDenied.ok).toBe(false);
    if (!staffCcDenied.ok) {
      expect(staffCcDenied.error).toBe(INVOICE_EMAIL_CC_FORBIDDEN);
    }

    const adminWithCc = await sendInvoiceEmail(
      admin,
      INVOICE_ID,
      { cc: ["finance@example.com"], bcc: ["audit@example.com"] },
      baseDeps,
    );
    expect(adminWithCc.ok).toBe(true);
    expect(memoryEmail.sent.at(-1)?.cc).toEqual(["finance@example.com"]);
    expect(memoryEmail.sent.at(-1)?.bcc).toEqual(["audit@example.com"]);
  });
});
