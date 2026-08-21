import { describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { INVOICE_PDF_FORBIDDEN, INVOICE_PDF_NOT_FOUND } from "@/domain/invoices/pdf";
import type { InvoiceRecord } from "@/domain/invoices/types";
import { downloadInvoicePdf } from "@/server/invoices/invoice-pdf-service";
import { MemoryStorageService } from "@/server/storage/memory-storage";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const INVOICE_ID = "eeeeeeee-eeee-4eee-8eee-000000000040";
const FILE_ID = "ffffffff-ffff-4fff-8fff-000000000040";
const VERSION_ID = "dddddddd-dddd-4ddd-8ddd-000000000040";
const ADMIN_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const STAFF_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_STAFF = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function invoiceRecord(overrides: Partial<InvoiceRecord> = {}): InvoiceRecord {
  return {
    id: INVOICE_ID,
    companyId: COMPANY_A,
    customerId: "dddddddd-dddd-4ddd-8ddd-000000000001",
    invoiceNumber: "DL-000001",
    invoiceDate: new Date("2026-08-01T00:00:00.000Z"),
    dueDate: new Date("2026-09-01T00:00:00.000Z"),
    currencyCode: "USD",
    referencePo: null,
    assignedStaffUserId: STAFF_ID,
    status: "ISSUED",
    complianceStatus: "NOT_REVIEWED",
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
    createdByUserId: STAFF_ID,
    updatedByUserId: STAFF_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("invoice PDF download authorization (TASK-040)", () => {
  it("denies Staff for unassigned invoices and returns stored bytes for allowed actors", async () => {
    const storage = new MemoryStorageService();
    const storageKey = `companies/${COMPANY_A}/invoices/${INVOICE_ID}/v1.pdf`;
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]); // %PDF-1
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

    const invoice = invoiceRecord();
    const deps = {
      invoices: {
        async getInvoiceById() {
          return invoice;
        },
      },
      versions: {
        async listByInvoiceId() {
          return [
            {
              id: VERSION_ID,
              invoiceId: INVOICE_ID,
              versionNo: 1,
              snapshot: {
                invoiceId: INVOICE_ID,
                companyId: COMPANY_A,
                customerId: invoice.customerId,
                invoiceNumber: "DL-000001",
                invoiceDate: "2026-08-01",
                dueDate: "2026-09-01",
                currencyCode: "USD",
                referencePo: null,
                assignedStaffUserId: STAFF_ID,
                status: "ISSUED",
                complianceStatus: "NOT_REVIEWED",
                internalNotes: null,
                customerNotes: null,
                subtotal: "10.0000",
                discountTotal: "0.0000",
                taxTotal: "0.0000",
                invoiceTotal: "10.0000",
                confirmedPaidAmount: "0.0000",
                outstandingAmount: "10.0000",
                lineItems: [],
              },
              reason: "Issued",
              createdByUserId: ADMIN_ID,
              createdAt: new Date(),
            },
          ];
        },
      },
      files: {
        async getById() {
          return file;
        },
        async getByInvoiceVersionId() {
          return file;
        },
        async createFile() {
          return file;
        },
        async listByInvoiceId() {
          return [file];
        },
      },
      companies: {
        async getCompanyById() {
          return null;
        },
      },
      branding: {
        async getBrandingByCompanyId() {
          return null;
        },
      },
      customers: {
        async getCustomerById() {
          return null;
        },
      },
      storage,
    };

    const unassignedStaff: AuthorizationPrincipal = {
      userId: OTHER_STAFF,
      status: "ACTIVE",
      roleCode: "STAFF",
      assignedCompanyIds: [COMPANY_A],
    };
    const denied = await downloadInvoicePdf(
      unassignedStaff,
      INVOICE_ID,
      { fileId: FILE_ID, disposition: "attachment" },
      deps,
    );
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.status).toBe(403);
      expect(denied.error).toBe(INVOICE_PDF_FORBIDDEN);
    }

    const assignedStaff: AuthorizationPrincipal = {
      userId: STAFF_ID,
      status: "ACTIVE",
      roleCode: "STAFF",
      assignedCompanyIds: [COMPANY_A],
    };
    const allowed = await downloadInvoicePdf(
      assignedStaff,
      INVOICE_ID,
      { fileId: FILE_ID, disposition: "inline" },
      deps,
    );
    expect(allowed.ok).toBe(true);
    if (!allowed.ok) {
      throw new Error(allowed.error);
    }
    expect(allowed.data.disposition).toBe("inline");
    expect(allowed.data.filename).toContain("DL-000001");
    expect(Buffer.from(allowed.data.bytes).toString("latin1")).toContain("%PDF");

    const missingObjectDeps = {
      ...deps,
      storage: new MemoryStorageService(),
    };
    const missing = await downloadInvoicePdf(
      assignedStaff,
      INVOICE_ID,
      { fileId: FILE_ID },
      missingObjectDeps,
    );
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.status).toBe(404);
      expect(missing.error).toBe(INVOICE_PDF_NOT_FOUND);
    }
  });
});
