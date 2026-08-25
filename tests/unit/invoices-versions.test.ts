import { describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import {
  buildInvoiceVersionSnapshot,
  payloadContainsIssuedFinancialFields,
} from "@/domain/invoices/versions";
import { updateIssuedInvoiceMetadata } from "@/server/invoices/invoice-version-service";
import { createMemoryAuditWriter } from "../helpers/memory-audit-writer";

describe("invoice version snapshot helpers", () => {
  it("builds a snapshot with Decimal string totals and line items", () => {
    const snapshot = buildInvoiceVersionSnapshot(
      {
        id: "inv-1",
        companyId: "co-1",
        customerId: "cu-1",
        invoiceNumber: "VX-000001",
        invoiceDate: new Date("2026-08-01T00:00:00.000Z"),
        dueDate: new Date("2026-08-15T00:00:00.000Z"),
        currencyCode: "USD",
        referencePo: null,
        assignedStaffUserId: null,
        status: "ISSUED",
        complianceStatus: "NOT_REVIEWED",
        internalNotes: null,
        customerNotes: null,
        subtotal: "100.0000",
        discountTotal: "0.0000",
        taxTotal: "0.0000",
        invoiceTotal: "100.0000",
        confirmedPaidAmount: "0.0000",
        outstandingAmount: "100.0000",
        cancellationReason: null,
        cancelledAt: null,
        cancelledByUserId: null,
        createdByUserId: null,
        updatedByUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      [
        {
          id: "li-1",
          invoiceId: "inv-1",
          sortOrder: 0,
          description: "Work",
          quantity: "1.000000",
          unitRate: "100.0000",
          taxName: null,
          taxRatePercent: null,
          lineTotal: "100.0000",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    );
    expect(snapshot.invoiceNumber).toBe("VX-000001");
    expect(snapshot.lineItems).toHaveLength(1);
    expect(snapshot.invoiceTotal).toBe("100.0000");
  });

  it("detects issued financial PATCH keys", () => {
    expect(payloadContainsIssuedFinancialFields({ currencyCode: "USD" })).toBe(true);
    expect(payloadContainsIssuedFinancialFields({ invoiceTotal: "1" })).toBe(true);
    expect(payloadContainsIssuedFinancialFields({ referencePo: "PO-1" })).toBe(false);
  });
});

describe("issued metadata authorization", () => {
  it("rejects Staff metadata updates and financial payloads", async () => {
    const staff: AuthorizationPrincipal = {
      userId: "staff-1",
      status: "ACTIVE",
      roleCode: "STAFF",
    };
    const invoice = {
      id: "ffffffff-ffff-4fff-8fff-000000000001",
      companyId: "11111111-1111-4111-8111-111111111111",
      customerId: "dddddddd-dddd-4ddd-8ddd-000000000001",
      invoiceNumber: "AA-000001",
      invoiceDate: new Date("2026-08-01T00:00:00.000Z"),
      dueDate: new Date("2026-08-15T00:00:00.000Z"),
      currencyCode: "USD",
      referencePo: null,
      assignedStaffUserId: null,
      status: "ISSUED" as const,
      complianceStatus: "NOT_REVIEWED" as const,
      internalNotes: null,
      customerNotes: null,
      subtotal: "0",
      discountTotal: "0",
      taxTotal: "0",
      invoiceTotal: "0",
      confirmedPaidAmount: "0",
      outstandingAmount: "0",
      cancellationReason: null,
      cancelledAt: null,
      cancelledByUserId: null,
      createdByUserId: "staff-1",
      updatedByUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const deps = {
      versions: {
        async listByInvoiceId() {
          return [];
        },
        async getNextVersionNo() {
          return 1;
        },
        async createVersion() {
          throw new Error("should not create");
        },
      },
      invoices: {
        async getInvoiceById() {
          return invoice;
        },
        async listLineItems() {
          return [];
        },
        async updateInvoice() {
          throw new Error("should not update");
        },
      },
      auditWriter: createMemoryAuditWriter(),
    };

    const financial = await updateIssuedInvoiceMetadata(
      staff,
      invoice.id,
      { currencyCode: "AED" },
      deps,
    );
    expect(financial.ok).toBe(false);
    if (!financial.ok) {
      expect(financial.status).toBe(400);
    }

    const metadata = await updateIssuedInvoiceMetadata(
      staff,
      invoice.id,
      {
        referencePo: "PO",
        assignedStaffUserId: null,
        internalNotes: null,
        customerNotes: null,
      },
      deps,
    );
    expect(metadata.ok).toBe(false);
    if (!metadata.ok) {
      expect(metadata.status).toBe(403);
    }
  });
});
