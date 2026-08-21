import { describe, expect, it } from "vitest";

import {
  applyInvoiceEmailMergeFields,
  buildInvoiceEmailContent,
  isValidCustomerEmail,
  parseEmailAddressList,
  validateEmailAddressList,
} from "@/domain/invoices/email";

describe("invoice email templates (TASK-041/042)", () => {
  it("rejects missing customer email (BR-017)", () => {
    expect(isValidCustomerEmail(null)).toBe(false);
    expect(isValidCustomerEmail("")).toBe(false);
    expect(isValidCustomerEmail("not-an-email")).toBe(false);
    expect(isValidCustomerEmail("jane@example.com")).toBe(true);
  });

  it("parses and validates CC/BCC address lists", () => {
    expect(parseEmailAddressList("a@x.com, b@y.com;c@z.com")).toEqual([
      "a@x.com",
      "b@y.com",
      "c@z.com",
    ]);
    expect(validateEmailAddressList(["ok@example.com"]).ok).toBe(true);
    expect(validateEmailAddressList(["bad"]).ok).toBe(false);
  });

  it("applies Notifications §14.1 merge fields", () => {
    const fields = {
      company_name: "Acme",
      customer_name: "Jane",
      invoice_number: "AC-000001",
      invoice_date: "2026-08-01",
      due_date: "2026-09-01",
      invoice_currency: "USD",
      invoice_total: "100.0000",
      amount_paid: "0.0000",
      balance_due: "100.0000",
      payment_link: "Payment link: https://pay.example/x",
      company_email: "billing@acme.test",
      company_phone: "+1 555",
    };
    expect(applyInvoiceEmailMergeFields("Hi {{customer_name}} — {{invoice_number}}", fields)).toBe(
      "Hi Jane — AC-000001",
    );
    const content = buildInvoiceEmailContent({
      fields,
      templateReference: "brand-default",
    });
    expect(content.subject).toContain("AC-000001");
    expect(content.subject).toContain("Acme");
    expect(content.text).toContain("Jane");
    expect(content.text).toContain("Payment link: https://pay.example/x");
    expect(content.text).toContain("Template reference: brand-default");
  });
});
