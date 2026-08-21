import { describe, expect, it } from "vitest";

import {
  formatInvoiceNumber,
  invoiceNumberYearForTimezone,
  INVOICE_NUMBER_PREFIX_REQUIRED,
  rejectHandEditedInvoiceNumber,
} from "@/domain/invoices/numbering";

describe("invoice number formatting", () => {
  it("formats prefix + padded sequence", () => {
    expect(formatInvoiceNumber({ prefix: "VX-", sequence: 1 })).toBe("VX-000001");
    expect(formatInvoiceNumber({ prefix: "ACME-", sequence: 42 })).toBe("ACME-000042");
  });

  it("includes optional year component", () => {
    expect(formatInvoiceNumber({ prefix: "VX-", sequence: 7, year: 2026 })).toBe("VX-2026-000007");
  });

  it("rejects empty prefix", () => {
    expect(() => formatInvoiceNumber({ prefix: "  ", sequence: 1 })).toThrow(
      INVOICE_NUMBER_PREFIX_REQUIRED,
    );
  });

  it("resolves calendar year for a timezone", () => {
    const at = new Date("2026-01-01T02:00:00.000Z");
    expect(invoiceNumberYearForTimezone("UTC", at)).toBe(2026);
    expect(invoiceNumberYearForTimezone("America/Los_Angeles", at)).toBe(2025);
  });
});

describe("hand-edited invoice numbers", () => {
  it("rejects client-supplied invoiceNumber", () => {
    const rejected = rejectHandEditedInvoiceNumber({ invoiceNumber: "VX-000001" });
    expect(rejected?.ok).toBe(false);
  });

  it("allows payloads without invoiceNumber", () => {
    expect(rejectHandEditedInvoiceNumber({ companyId: "x" })).toBeNull();
    expect(rejectHandEditedInvoiceNumber({ invoiceNumber: null })).toBeNull();
  });
});
