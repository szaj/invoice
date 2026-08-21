import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  computeInvoiceLineTotal,
  INVOICE_LINE_QUANTITY_INVALID,
} from "@/domain/invoices/line-items";
import {
  invoiceLineItemWriteSchema,
  invoiceLineItemsReplaceSchema,
} from "@/domain/invoices/line-item-schema";

describe("computeInvoiceLineTotal", () => {
  it("calculates round(quantity × unitRate) with Decimal precision", () => {
    expect(
      computeInvoiceLineTotal({
        quantity: "2",
        unitRate: "10.555",
        decimalPrecision: 2,
      }),
    ).toBe("21.11");
    expect(
      computeInvoiceLineTotal({
        quantity: "1.5",
        unitRate: "10.00",
        decimalPrecision: 2,
      }),
    ).toBe("15");
  });

  it("rejects quantity <= 0", () => {
    expect(() =>
      computeInvoiceLineTotal({
        quantity: "0",
        unitRate: "10.00",
        decimalPrecision: 2,
      }),
    ).toThrow(INVOICE_LINE_QUANTITY_INVALID);
    expect(() =>
      computeInvoiceLineTotal({
        quantity: "-1",
        unitRate: "10.00",
        decimalPrecision: 2,
      }),
    ).toThrow(INVOICE_LINE_QUANTITY_INVALID);
  });

  it("rejects JavaScript number inputs", () => {
    expect(() =>
      computeInvoiceLineTotal({
        quantity: 2 as unknown as string,
        unitRate: "10.00",
        decimalPrecision: 2,
      }),
    ).toThrow(/JavaScript number/);
  });
});

describe("invoiceLineItemWriteSchema", () => {
  it("defaults quantity to 1 and requires description", () => {
    const ok = invoiceLineItemWriteSchema.safeParse({
      description: "Consulting",
      unitRate: "100.00",
      taxName: null,
      taxRatePercent: null,
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.quantity).toBe("1");
    }

    expect(
      invoiceLineItemWriteSchema.safeParse({
        description: " ",
        quantity: "1",
        unitRate: "10.00",
        taxName: null,
        taxRatePercent: null,
      }).success,
    ).toBe(false);

    expect(
      invoiceLineItemWriteSchema.safeParse({
        description: "Item",
        quantity: "0",
        unitRate: "10.00",
        taxName: null,
        taxRatePercent: null,
      }).success,
    ).toBe(false);
  });

  it("rejects discount fields while ADR-010 is open", () => {
    expect(
      invoiceLineItemsReplaceSchema.safeParse({
        lineItems: [
          {
            description: "Item",
            quantity: "1",
            unitRate: "10.00",
            taxName: null,
            taxRatePercent: null,
            discount: "1.00",
          },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("invoice line items migration", () => {
  it("creates invoice_items without discount or payments tables", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "prisma/migrations/20260821180000_invoice_line_items/migration.sql"),
      "utf8",
    );
    expect(sql).toContain('CREATE TABLE "invoice_items"');
    expect(sql).toContain('"quantity"');
    expect(sql).toContain('"unit_rate"');
    expect(sql).toContain('"line_total"');
    expect(sql).toContain('"tax_name"');
    expect(sql).toContain('"tax_rate_percent"');
    expect(sql).not.toContain("discount");
    expect(sql).not.toContain('CREATE TABLE "payments"');
  });
});
