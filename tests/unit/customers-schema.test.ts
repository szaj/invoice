import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { customerStatusUpdateSchema, customerWriteSchema } from "@/domain/customers/schema";

const validWrite = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  displayName: "Acme Trading LLC",
  customerType: "BUSINESS",
  ...overrides,
});

describe("customer domain schema constraints", () => {
  it("allows create without email", () => {
    const parsed = customerWriteSchema.safeParse(validWrite());
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw new Error("expected success");
    }
    expect(parsed.data.email).toBeNull();
    expect(parsed.data.status).toBe("ACTIVE");
    expect(parsed.data.tags).toEqual([]);
  });

  it("requires display name and customer type", () => {
    expect(customerWriteSchema.safeParse({ customerType: "INDIVIDUAL" }).success).toBe(false);
    expect(customerWriteSchema.safeParse({ displayName: "Solo" }).success).toBe(false);
    expect(
      customerWriteSchema.safeParse(validWrite({ displayName: "  ", customerType: "INDIVIDUAL" }))
        .success,
    ).toBe(false);
  });

  it("accepts Individual/Business types and optional contact fields", () => {
    const individual = customerWriteSchema.safeParse(
      validWrite({
        customerType: "INDIVIDUAL",
        contactPerson: "Jane Doe",
        phone: "+1 555 0100",
        alternatePhone: "+1 555 0101",
        email: "Jane.Doe@Example.COM",
      }),
    );
    expect(individual.success).toBe(true);
    if (!individual.success) {
      throw new Error("expected success");
    }
    expect(individual.data.email).toBe("jane.doe@example.com");
    expect(individual.data.customerType).toBe("INDIVIDUAL");
  });

  it("rejects invalid email when provided", () => {
    expect(customerWriteSchema.safeParse(validWrite({ email: "not-an-email" })).success).toBe(
      false,
    );
  });

  it("validates address country and default invoice currency codes", () => {
    expect(
      customerWriteSchema.safeParse(
        validWrite({
          countryCode: "ae",
          defaultInvoiceCurrencyCode: "aed",
          addressLine1: "Sheikh Zayed Rd",
          city: "Dubai",
        }),
      ).success,
    ).toBe(true);

    expect(customerWriteSchema.safeParse(validWrite({ countryCode: "XX" })).success).toBe(false);
    expect(
      customerWriteSchema.safeParse(validWrite({ defaultInvoiceCurrencyCode: "US" })).success,
    ).toBe(false);
  });

  it("normalizes tags and accepts companyIds; rejects unknown later-task fields", () => {
    const parsed = customerWriteSchema.safeParse(
      validWrite({
        tags: [" vip ", "vip", "dubai"],
        taxRegistrationId: "TRN-123",
        website: "https://acme.example",
        paymentPreference: "Bank transfer",
        internalNotes: "Preferred contact mornings",
        companyIds: ["11111111-1111-4111-8111-111111111111"],
      }),
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw new Error("expected success");
    }
    expect(parsed.data.tags).toEqual(["vip", "dubai"]);
    expect(parsed.data.companyIds).toEqual(["11111111-1111-4111-8111-111111111111"]);

    expect(
      customerWriteSchema.safeParse(
        validWrite({
          invoiceIds: ["11111111-1111-4111-8111-111111111111"],
        }),
      ).success,
    ).toBe(false);
  });

  it("supports soft status updates only via status schema", () => {
    expect(customerStatusUpdateSchema.safeParse({ status: "INACTIVE" }).success).toBe(true);
    expect(customerStatusUpdateSchema.safeParse({ status: "DELETED" }).success).toBe(false);
  });
});

describe("customer domain migration", () => {
  it("creates customers with soft status; company links are a separate TASK-025 migration", () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        "prisma/migrations/20260821000000_customer_domain_schema/migration.sql",
      ),
      "utf8",
    );
    expect(sql).toMatch(/CREATE TABLE "customers"/);
    expect(sql).toMatch(/customer_status/);
    expect(sql).toMatch(/"email" TEXT/);
    expect(sql).toMatch(/default_invoice_currency_code/);
    expect(sql).toMatch(/assigned_staff_user_id/);
    expect(sql).toMatch(/"tags" TEXT\[\]/);
    expect(sql).not.toMatch(/CREATE TABLE "customer_companies"/);
    expect(sql).not.toMatch(/CREATE TABLE "invoices"/);
    expect(sql.toLowerCase()).not.toMatch(/hard.?delete/);
  });

  it("adds customer_companies linkage migration", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "prisma/migrations/20260821120000_customer_companies/migration.sql"),
      "utf8",
    );
    expect(sql).toMatch(/CREATE TABLE "customer_companies"/);
    expect(sql).toMatch(/customer_id/);
    expect(sql).toMatch(/company_id/);
    expect(sql).toMatch(/INSERT INTO "customer_companies"/);
  });
});
