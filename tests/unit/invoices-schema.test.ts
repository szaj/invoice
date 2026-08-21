import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { invoiceHeaderWriteSchema } from "@/domain/invoices/schema";
import { INVOICE_COMPANY_CUSTOMER_REQUIRED } from "@/domain/invoices/types";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const CUSTOMER_ID = "22222222-2222-4222-8222-222222222222";

const validWrite = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  companyId: COMPANY_ID,
  customerId: CUSTOMER_ID,
  invoiceDate: "2026-08-21",
  dueDate: "2026-09-21",
  currencyCode: "USD",
  ...overrides,
});

describe("invoice header domain schema constraints", () => {
  it("requires company and customer (BR-001)", () => {
    expect(invoiceHeaderWriteSchema.safeParse({}).success).toBe(false);
    expect(invoiceHeaderWriteSchema.safeParse(validWrite({ companyId: undefined })).success).toBe(
      false,
    );
    expect(invoiceHeaderWriteSchema.safeParse(validWrite({ customerId: undefined })).success).toBe(
      false,
    );
    expect(
      invoiceHeaderWriteSchema.safeParse(
        validWrite({ companyId: "not-a-uuid", customerId: CUSTOMER_ID }),
      ).success,
    ).toBe(false);

    const missingCompany = invoiceHeaderWriteSchema.safeParse({
      customerId: CUSTOMER_ID,
      invoiceDate: "2026-08-21",
      dueDate: "2026-09-21",
      currencyCode: "USD",
    });
    expect(missingCompany.success).toBe(false);
  });

  it("accepts a valid draft header with optional notes and defaults", () => {
    const parsed = invoiceHeaderWriteSchema.safeParse(
      validWrite({
        currencyCode: "aed",
        referencePo: "PO-100",
        internalNotes: "Staff only",
        customerNotes: "Visible later on PDF",
      }),
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw new Error("expected success");
    }
    expect(parsed.data.companyId).toBe(COMPANY_ID);
    expect(parsed.data.customerId).toBe(CUSTOMER_ID);
    expect(parsed.data.currencyCode).toBe("AED");
    expect(parsed.data.status).toBe("DRAFT");
    expect(parsed.data.complianceStatus).toBe("NOT_REVIEWED");
    expect(parsed.data.invoiceNumber).toBeNull();
    expect(parsed.data.referencePo).toBe("PO-100");
    expect(INVOICE_COMPANY_CUSTOMER_REQUIRED.length).toBeGreaterThan(0);
  });

  it("requires invoice date, due date, and currency code format", () => {
    expect(invoiceHeaderWriteSchema.safeParse(validWrite({ invoiceDate: null })).success).toBe(
      false,
    );
    expect(invoiceHeaderWriteSchema.safeParse(validWrite({ dueDate: null })).success).toBe(false);
    expect(invoiceHeaderWriteSchema.safeParse(validWrite({ currencyCode: "US" })).success).toBe(
      false,
    );
    expect(invoiceHeaderWriteSchema.safeParse(validWrite({ currencyCode: "" })).success).toBe(
      false,
    );
  });

  it("rejects later-task fields (line items, totals, payments)", () => {
    expect(
      invoiceHeaderWriteSchema.safeParse(
        validWrite({
          lineItems: [{ description: "x", quantity: 1 }],
          invoiceTotal: "100.00",
          paymentId: COMPANY_ID,
        }),
      ).success,
    ).toBe(false);
  });

  it("migration creates invoices without line items or payments tables", () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        "prisma/migrations/20260821160000_invoice_domain_schema/migration.sql",
      ),
      "utf8",
    );
    expect(sql).toContain('CREATE TABLE "invoices"');
    expect(sql).toContain('"company_id"');
    expect(sql).toContain('"customer_id"');
    expect(sql).not.toContain("invoice_items");
    expect(sql).not.toContain("invoice_versions");
    expect(sql).not.toContain('CREATE TABLE "payments"');
  });
});
