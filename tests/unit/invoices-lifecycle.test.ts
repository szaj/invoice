import { describe, expect, it } from "vitest";

import {
  canTransitionInvoiceStatus,
  evaluateOverdueStatus,
  invoiceMeetsOverdueRule,
} from "@/domain/invoices/lifecycle";

describe("invoice lifecycle transitions (TASK-036 + TASK-038)", () => {
  it("allows issue, overdue, and cancel from Draft/Issued/Overdue", () => {
    expect(canTransitionInvoiceStatus("DRAFT", "ISSUED")).toBe(true);
    expect(canTransitionInvoiceStatus("ISSUED", "OVERDUE")).toBe(true);
    expect(canTransitionInvoiceStatus("PARTIALLY_PAID", "OVERDUE")).toBe(true);
    expect(canTransitionInvoiceStatus("DRAFT", "CANCELLED")).toBe(true);
    expect(canTransitionInvoiceStatus("ISSUED", "CANCELLED")).toBe(true);
    expect(canTransitionInvoiceStatus("OVERDUE", "CANCELLED")).toBe(true);
    expect(canTransitionInvoiceStatus("PARTIALLY_PAID", "CANCELLED")).toBe(false);
    expect(canTransitionInvoiceStatus("ISSUED", "PAID")).toBe(false);
    expect(canTransitionInvoiceStatus("ISSUED", "PARTIALLY_PAID")).toBe(false);
    expect(canTransitionInvoiceStatus("OVERDUE", "PAID")).toBe(false);
  });
});

describe("overdue rule (BR-018)", () => {
  const asOf = new Date("2026-08-21T12:00:00.000Z");

  it("marks issued invoices overdue when due date is past and balance > 0", () => {
    const invoice = {
      status: "ISSUED" as const,
      dueDate: new Date("2026-08-20T00:00:00.000Z"),
      outstandingAmount: "10.00",
    };
    expect(invoiceMeetsOverdueRule(invoice, asOf)).toBe(true);
    expect(evaluateOverdueStatus(invoice, asOf)).toBe("OVERDUE");
  });

  it("does not overdue drafts, paid-zero balance, or future due dates", () => {
    expect(
      invoiceMeetsOverdueRule(
        {
          status: "DRAFT",
          dueDate: new Date("2026-08-01T00:00:00.000Z"),
          outstandingAmount: "10.00",
        },
        asOf,
      ),
    ).toBe(false);
    expect(
      invoiceMeetsOverdueRule(
        {
          status: "ISSUED",
          dueDate: new Date("2026-08-01T00:00:00.000Z"),
          outstandingAmount: "0.00",
        },
        asOf,
      ),
    ).toBe(false);
    expect(
      invoiceMeetsOverdueRule(
        {
          status: "ISSUED",
          dueDate: new Date("2026-08-21T00:00:00.000Z"),
          outstandingAmount: "10.00",
        },
        asOf,
      ),
    ).toBe(false);
    expect(
      evaluateOverdueStatus(
        {
          status: "ISSUED",
          dueDate: new Date("2026-08-22T00:00:00.000Z"),
          outstandingAmount: "5.00",
        },
        asOf,
      ),
    ).toBeNull();
  });
});
