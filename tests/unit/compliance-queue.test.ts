import { describe, expect, it, vi } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import {
  COMPLIANCE_INVALID_INPUT,
  COMPLIANCE_QUEUE_FORBIDDEN,
  type ComplianceQueueItem,
} from "@/domain/compliance/types";
import { listComplianceQueue } from "@/server/compliance/compliance-service";

const assignedCompanyId = "22222222-2222-4222-8222-222222222222";
const otherCompanyId = "33333333-3333-4333-8333-333333333333";

function principal(
  roleCode: "ADMIN" | "COMPLIANCE" | "STAFF",
  assignedCompanyIds: string[] = [assignedCompanyId],
): AuthorizationPrincipal {
  return {
    userId: "11111111-1111-4111-8111-111111111111",
    status: "ACTIVE",
    roleCode,
    assignedCompanyIds,
  };
}

function queueItem(overrides: Partial<ComplianceQueueItem> = {}): ComplianceQueueItem {
  return {
    subjectType: "INVOICE",
    subjectId: "44444444-4444-4444-8444-444444444444",
    companyId: assignedCompanyId,
    complianceStatus: "NOT_REVIEWED",
    staffUserId: null,
    date: new Date("2026-08-01T00:00:00.000Z"),
    amount: "100.0000",
    currencyCode: "USD",
    gateway: null,
    label: "INV-1",
    customerId: "55555555-5555-4555-8555-555555555555",
    invoiceId: "44444444-4444-4444-8444-444444444444",
    ...overrides,
  };
}

describe("compliance review queue authorization (TASK-072)", () => {
  it("denies Staff with 403", async () => {
    const listQueue = vi.fn();
    const result = await listComplianceQueue(
      principal("STAFF"),
      {},
      {
        store: {
          createReview: vi.fn(),
          listReviews: vi.fn(),
          updateInvoiceComplianceStatus: vi.fn(),
          updatePaymentComplianceStatus: vi.fn(),
          updateCustomerComplianceStatus: vi.fn(),
          listQueue,
        },
        invoices: { getInvoiceById: vi.fn() },
        payments: { getPaymentById: vi.fn() },
        customers: { getCustomerById: vi.fn() },
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toBe(COMPLIANCE_QUEUE_FORBIDDEN);
    }
    expect(listQueue).not.toHaveBeenCalled();
  });

  it("scopes Compliance queue to assigned companies", async () => {
    const listQueue = vi.fn().mockResolvedValue([queueItem()]);
    const result = await listComplianceQueue(
      principal("COMPLIANCE"),
      {},
      {
        store: {
          createReview: vi.fn(),
          listReviews: vi.fn(),
          updateInvoiceComplianceStatus: vi.fn(),
          updatePaymentComplianceStatus: vi.fn(),
          updateCustomerComplianceStatus: vi.fn(),
          listQueue,
        },
        invoices: { getInvoiceById: vi.fn() },
        payments: { getPaymentById: vi.fn() },
        customers: { getCustomerById: vi.fn() },
      },
    );

    expect(result.ok).toBe(true);
    expect(listQueue).toHaveBeenCalledWith(
      expect.objectContaining({ companyIds: [assignedCompanyId] }),
    );
  });

  it("denies Compliance filter for an unassigned company", async () => {
    const listQueue = vi.fn();
    const result = await listComplianceQueue(
      principal("COMPLIANCE"),
      { companyId: otherCompanyId },
      {
        store: {
          createReview: vi.fn(),
          listReviews: vi.fn(),
          updateInvoiceComplianceStatus: vi.fn(),
          updatePaymentComplianceStatus: vi.fn(),
          updateCustomerComplianceStatus: vi.fn(),
          listQueue,
        },
        invoices: { getInvoiceById: vi.fn() },
        payments: { getPaymentById: vi.fn() },
        customers: { getCustomerById: vi.fn() },
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toBe(COMPLIANCE_QUEUE_FORBIDDEN);
    }
    expect(listQueue).not.toHaveBeenCalled();
  });

  it("allows Admin all-companies queue without companyId", async () => {
    const listQueue = vi
      .fn()
      .mockResolvedValue([
        queueItem(),
        queueItem({ companyId: otherCompanyId, subjectId: "66666666-6666-4666-8666-666666666666" }),
      ]);
    const result = await listComplianceQueue(
      principal("ADMIN", []),
      {},
      {
        store: {
          createReview: vi.fn(),
          listReviews: vi.fn(),
          updateInvoiceComplianceStatus: vi.fn(),
          updatePaymentComplianceStatus: vi.fn(),
          updateCustomerComplianceStatus: vi.fn(),
          listQueue,
        },
        invoices: { getInvoiceById: vi.fn() },
        payments: { getPaymentById: vi.fn() },
        customers: { getCustomerById: vi.fn() },
      },
    );

    expect(result.ok).toBe(true);
    expect(listQueue).toHaveBeenCalledWith(expect.objectContaining({ companyIds: "ALL" }));
    if (result.ok) {
      expect(result.data).toHaveLength(2);
    }
  });

  it("rejects invalid filter input", async () => {
    const result = await listComplianceQueue(
      principal("ADMIN"),
      { amountMin: 12.34 },
      {
        store: {
          createReview: vi.fn(),
          listReviews: vi.fn(),
          updateInvoiceComplianceStatus: vi.fn(),
          updatePaymentComplianceStatus: vi.fn(),
          updateCustomerComplianceStatus: vi.fn(),
          listQueue: vi.fn(),
        },
        invoices: { getInvoiceById: vi.fn() },
        payments: { getPaymentById: vi.fn() },
        customers: { getCustomerById: vi.fn() },
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toBe(COMPLIANCE_INVALID_INPUT);
    }
  });

  it("returns empty when Compliance has no company assignments", async () => {
    const listQueue = vi.fn();
    const result = await listComplianceQueue(
      principal("COMPLIANCE", []),
      {},
      {
        store: {
          createReview: vi.fn(),
          listReviews: vi.fn(),
          updateInvoiceComplianceStatus: vi.fn(),
          updatePaymentComplianceStatus: vi.fn(),
          updateCustomerComplianceStatus: vi.fn(),
          listQueue,
        },
        invoices: { getInvoiceById: vi.fn() },
        payments: { getPaymentById: vi.fn() },
        customers: { getCustomerById: vi.fn() },
      },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([]);
    }
    expect(listQueue).not.toHaveBeenCalled();
  });
});
