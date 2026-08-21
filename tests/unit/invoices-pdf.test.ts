import { describe, expect, it } from "vitest";

import { buildInvoicePdfRenderModel, invoicePdfStorageKey } from "@/domain/invoices/pdf";
import type { InvoiceVersionSnapshot } from "@/domain/invoices/versions";
import { renderInvoicePdfBytes } from "@/server/invoices/invoice-pdf-render";

const INTERNAL_NOTE = "SECRET_INTERNAL_NOTE_NEVER_PRINT_XYZ";

function snapshot(overrides: Partial<InvoiceVersionSnapshot> = {}): InvoiceVersionSnapshot {
  return {
    invoiceId: "inv-1",
    companyId: "co-1",
    customerId: "cu-1",
    invoiceNumber: "PDF-000001",
    invoiceDate: "2026-08-01",
    dueDate: "2026-08-15",
    currencyCode: "USD",
    referencePo: "PO-9",
    assignedStaffUserId: null,
    status: "ISSUED",
    complianceStatus: "NOT_REVIEWED",
    internalNotes: INTERNAL_NOTE,
    customerNotes: "Thanks for your business",
    subtotal: "100.0000",
    discountTotal: "0.0000",
    taxTotal: "0.0000",
    invoiceTotal: "100.0000",
    confirmedPaidAmount: "0.0000",
    outstandingAmount: "100.0000",
    lineItems: [
      {
        sortOrder: 0,
        description: "Consulting",
        quantity: "1.000000",
        unitRate: "100.0000",
        taxName: null,
        taxRatePercent: null,
        lineTotal: "100.0000",
      },
    ],
    ...overrides,
  };
}

describe("invoice PDF render model (TASK-039)", () => {
  it("builds a storage key and omits internal notes from the render model", () => {
    const model = buildInvoicePdfRenderModel({
      pageSize: "A4",
      versionNo: 1,
      snapshot: snapshot(),
      company: {
        displayName: "Acme",
        legalName: "Acme LLC",
        email: "billing@acme.test",
        phone: null,
        website: null,
        registrationTaxNumber: null,
        addressLine1: "1 Main",
        addressLine2: null,
        city: "Austin",
        region: "TX",
        postalCode: "78701",
        countryCode: "US",
        termsAndConditions: "Net 15",
        logoDataUri: null,
      },
      customer: {
        displayName: "Buyer Co",
        contactPerson: null,
        email: "ap@buyer.test",
        phone: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        region: null,
        postalCode: null,
        countryCode: null,
        taxRegistrationId: null,
      },
    });

    expect(model.invoice.invoiceNumber).toBe("PDF-000001");
    expect(model.invoice.customerNotes).toBe("Thanks for your business");
    expect(JSON.stringify(model)).not.toContain(INTERNAL_NOTE);
    expect(invoicePdfStorageKey({ companyId: "co-1", invoiceId: "inv-1", versionNo: 2 })).toBe(
      "companies/co-1/invoices/inv-1/v2.pdf",
    );
  });

  it("renders PDF bytes without internal notes in the extractable text fixture", async () => {
    const model = buildInvoicePdfRenderModel({
      pageSize: "LETTER",
      versionNo: 1,
      snapshot: snapshot(),
      company: {
        displayName: "Brand Co",
        legalName: null,
        email: null,
        phone: null,
        website: null,
        registrationTaxNumber: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        region: null,
        postalCode: null,
        countryCode: null,
        termsAndConditions: "Pay within 30 days",
        logoDataUri: null,
      },
      customer: {
        displayName: "Customer",
        contactPerson: null,
        email: null,
        phone: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        region: null,
        postalCode: null,
        countryCode: null,
        taxRegistrationId: null,
      },
    });

    const rendered = await renderInvoicePdfBytes(model);
    expect(rendered.byteSize).toBeGreaterThan(500);
    expect(rendered.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
    const asText = Buffer.from(rendered.bytes).toString("latin1");
    expect(asText.startsWith("%PDF")).toBe(true);
    // Content streams are compressed; metadata/title remains extractable.
    expect(asText).toContain("Invoice PDF-000001");
    expect(asText).toContain("Brand Co");
    // Internal notes must never leak into PDF bytes (including metadata).
    expect(asText).not.toContain(INTERNAL_NOTE);
    expect(Buffer.from(rendered.bytes).includes(Buffer.from(INTERNAL_NOTE))).toBe(false);
  }, 30_000);
});
