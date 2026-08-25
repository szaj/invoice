import { describe, expect, it, vi } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { COMPLIANCE_STATUS_FORBIDDEN } from "@/domain/compliance/types";
import { updateComplianceStatus } from "@/server/compliance/compliance-service";

function principal(roleCode: "ADMIN" | "COMPLIANCE" | "STAFF"): AuthorizationPrincipal {
  return {
    userId: "11111111-1111-4111-8111-111111111111",
    status: "ACTIVE",
    roleCode,
    assignedCompanyIds: ["22222222-2222-4222-8222-222222222222"],
  };
}

const invoiceId = "33333333-3333-4333-8333-333333333333";
const companyId = "22222222-2222-4222-8222-222222222222";

describe("compliance status update authorization (TASK-071)", () => {
  it("denies Staff with 403", async () => {
    const result = await updateComplianceStatus(
      principal("STAFF"),
      {
        subjectType: "INVOICE",
        subjectId: invoiceId,
        status: "UNDER_REVIEW",
      },
      {
        store: {
          createReview: vi.fn(),
          updateInvoiceComplianceStatus: vi.fn(),
          updatePaymentComplianceStatus: vi.fn(),
          updateCustomerComplianceStatus: vi.fn(),
        },
        invoices: {
          getInvoiceById: vi.fn(),
        },
        payments: {
          getPaymentById: vi.fn(),
        },
        customers: {
          getCustomerById: vi.fn(),
        },
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toBe(COMPLIANCE_STATUS_FORBIDDEN);
    }
  });

  it("allows Admin to update invoice compliance status and write a review", async () => {
    const createReview = vi.fn().mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
      companyId,
      subjectType: "INVOICE",
      subjectId: invoiceId,
      status: "APPROVED",
      reviewerUserId: principal("ADMIN").userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const updateInvoiceComplianceStatus = vi.fn().mockResolvedValue(undefined);

    const result = await updateComplianceStatus(
      principal("ADMIN"),
      {
        subjectType: "INVOICE",
        subjectId: invoiceId,
        status: "APPROVED",
      },
      {
        store: {
          createReview,
          updateInvoiceComplianceStatus,
          updatePaymentComplianceStatus: vi.fn(),
          updateCustomerComplianceStatus: vi.fn(),
        },
        invoices: {
          getInvoiceById: vi.fn().mockResolvedValue({
            id: invoiceId,
            companyId,
            customerId: "55555555-5555-4555-8555-555555555555",
            invoiceNumber: "INV-1",
            invoiceDate: new Date(),
            dueDate: new Date(),
            currencyCode: "USD",
            referencePo: null,
            assignedStaffUserId: null,
            status: "ISSUED",
            complianceStatus: "NOT_REVIEWED",
            internalNotes: null,
            customerNotes: null,
            subtotal: "10.0000",
            discountTotal: "0.0000",
            taxTotal: "0.0000",
            invoiceTotal: "10.0000",
            confirmedPaidAmount: "0.0000",
            outstandingAmount: "10.0000",
            cancellationReason: null,
            cancelledAt: null,
            cancelledByUserId: null,
            createdByUserId: principal("ADMIN").userId,
            updatedByUserId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
        payments: { getPaymentById: vi.fn() },
        customers: { getCustomerById: vi.fn() },
        auditWriter: {
          append: vi.fn().mockResolvedValue({ id: "audit" }),
        },
        enforceTransactionalCompanyScope: async () => ({ ok: true as const, data: true as const }),
      },
    );

    expect(result.ok).toBe(true);
    expect(updateInvoiceComplianceStatus).toHaveBeenCalledWith(invoiceId, "APPROVED", {
      updatedByUserId: principal("ADMIN").userId,
    });
    expect(createReview).toHaveBeenCalled();
    if (result.ok) {
      expect(result.data.status).toBe("APPROVED");
      expect(result.data.previousStatus).toBe("NOT_REVIEWED");
    }
  });

  it("allows Compliance role to update status", async () => {
    const result = await updateComplianceStatus(
      principal("COMPLIANCE"),
      {
        subjectType: "INVOICE",
        subjectId: invoiceId,
        status: "FLAGGED",
      },
      {
        store: {
          createReview: vi.fn().mockResolvedValue({
            id: "66666666-6666-4666-8666-666666666666",
            companyId,
            subjectType: "INVOICE",
            subjectId: invoiceId,
            status: "FLAGGED",
            reviewerUserId: principal("COMPLIANCE").userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
          updateInvoiceComplianceStatus: vi.fn(),
          updatePaymentComplianceStatus: vi.fn(),
          updateCustomerComplianceStatus: vi.fn(),
        },
        invoices: {
          getInvoiceById: vi.fn().mockResolvedValue({
            id: invoiceId,
            companyId,
            customerId: "55555555-5555-4555-8555-555555555555",
            invoiceNumber: "INV-1",
            invoiceDate: new Date(),
            dueDate: new Date(),
            currencyCode: "USD",
            referencePo: null,
            assignedStaffUserId: null,
            status: "ISSUED",
            complianceStatus: "UNDER_REVIEW",
            internalNotes: null,
            customerNotes: null,
            subtotal: "10.0000",
            discountTotal: "0.0000",
            taxTotal: "0.0000",
            invoiceTotal: "10.0000",
            confirmedPaidAmount: "0.0000",
            outstandingAmount: "10.0000",
            cancellationReason: null,
            cancelledAt: null,
            cancelledByUserId: null,
            createdByUserId: principal("COMPLIANCE").userId,
            updatedByUserId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
        payments: { getPaymentById: vi.fn() },
        customers: { getCustomerById: vi.fn() },
        auditWriter: { append: vi.fn().mockResolvedValue({ id: "audit" }) },
        enforceTransactionalCompanyScope: async () => ({ ok: true as const, data: true as const }),
      },
    );

    expect(result.ok).toBe(true);
  });
});
