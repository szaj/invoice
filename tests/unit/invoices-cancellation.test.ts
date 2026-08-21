import { describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import {
  canCancelInvoiceStatus,
  invoiceCancelInputSchema,
  isCollectibleInvoiceStatus,
  INVOICE_CANCEL_REASON_REQUIRED,
} from "@/domain/invoices/cancellation";
import type { InvoiceRecord } from "@/domain/invoices/types";
import { cancelInvoice } from "@/server/invoices/invoice-cancel-service";
import { createMemoryAuditWriter } from "../helpers/memory-audit-writer";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const INVOICE_ID = "eeeeeeee-eeee-4eee-8eee-000000000038";
const ADMIN_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const STAFF_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function principal(
  roleCode: AuthorizationPrincipal["roleCode"],
  overrides: Partial<AuthorizationPrincipal> = {},
): AuthorizationPrincipal {
  return {
    userId: roleCode === "STAFF" ? STAFF_ID : ADMIN_ID,
    status: "ACTIVE",
    roleCode,
    assignedCompanyIds: roleCode === "ADMIN" ? [] : [COMPANY_A],
    ...overrides,
  };
}

describe("invoice cancellation domain (TASK-038)", () => {
  it("allows cancel only from Draft, Issued, and Overdue", () => {
    expect(canCancelInvoiceStatus("DRAFT")).toBe(true);
    expect(canCancelInvoiceStatus("ISSUED")).toBe(true);
    expect(canCancelInvoiceStatus("OVERDUE")).toBe(true);
    expect(canCancelInvoiceStatus("PARTIALLY_PAID")).toBe(false);
    expect(canCancelInvoiceStatus("PAID")).toBe(false);
    expect(canCancelInvoiceStatus("CANCELLED")).toBe(false);
  });

  it("requires a non-empty trimmed reason", () => {
    expect(invoiceCancelInputSchema.safeParse({ reason: "" }).success).toBe(false);
    expect(invoiceCancelInputSchema.safeParse({ reason: "   " }).success).toBe(false);
    expect(invoiceCancelInputSchema.safeParse({ reason: "Duplicate" }).success).toBe(true);
  });

  it("excludes cancelled and draft from collectible outstanding (BR-019)", () => {
    expect(isCollectibleInvoiceStatus("ISSUED")).toBe(true);
    expect(isCollectibleInvoiceStatus("OVERDUE")).toBe(true);
    expect(isCollectibleInvoiceStatus("CANCELLED")).toBe(false);
    expect(isCollectibleInvoiceStatus("DRAFT")).toBe(false);
  });
});

describe("cancelInvoice authorization and reason", () => {
  it("rejects Staff and missing reason; Admin cancel preserves totals", async () => {
    const issued: InvoiceRecord = {
      id: INVOICE_ID,
      companyId: COMPANY_A,
      customerId: "dddddddd-dddd-4ddd-8ddd-000000000001",
      invoiceNumber: "CX-000001",
      invoiceDate: new Date("2026-08-01T00:00:00.000Z"),
      dueDate: new Date("2026-09-01T00:00:00.000Z"),
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
      createdByUserId: STAFF_ID,
      updatedByUserId: STAFF_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    let stored: InvoiceRecord = { ...issued };
    const audit = createMemoryAuditWriter();
    const deps = {
      invoices: {
        async getInvoiceById() {
          return stored;
        },
        async cancelInvoice(
          id: string,
          input: {
            readonly reason: string;
            readonly cancelledAt: Date;
            readonly cancelledByUserId: string;
          },
        ): Promise<InvoiceRecord> {
          stored = {
            ...stored,
            id,
            status: "CANCELLED",
            cancellationReason: input.reason,
            cancelledAt: input.cancelledAt,
            cancelledByUserId: input.cancelledByUserId,
            updatedByUserId: input.cancelledByUserId,
          };
          return stored;
        },
      },
      auditWriter: audit,
      now: () => new Date("2026-08-21T12:00:00.000Z"),
    };

    const staffDenied = await cancelInvoice(
      principal("STAFF"),
      INVOICE_ID,
      { reason: "Nope" },
      deps,
    );
    expect(staffDenied.ok).toBe(false);
    if (!staffDenied.ok) {
      expect(staffDenied.status).toBe(403);
    }

    const missingReason = await cancelInvoice(principal("ADMIN"), INVOICE_ID, { reason: "" }, deps);
    expect(missingReason.ok).toBe(false);
    if (!missingReason.ok) {
      expect(missingReason.error).toBe(INVOICE_CANCEL_REASON_REQUIRED);
    }

    const cancelled = await cancelInvoice(
      principal("ADMIN"),
      INVOICE_ID,
      { reason: "Customer withdrew" },
      deps,
    );
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) {
      throw new Error(cancelled.error);
    }
    expect(cancelled.data.status).toBe("CANCELLED");
    expect(cancelled.data.cancellationReason).toBe("Customer withdrew");
    expect(cancelled.data.invoiceNumber).toBe("CX-000001");
    expect(cancelled.data.invoiceTotal).toBe("100.0000");
    expect(cancelled.data.outstandingAmount).toBe("100.0000");
    expect(audit.events.some((e) => e.action === "invoices.cancelled")).toBe(true);
  });
});
