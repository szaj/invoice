import { describe, expect, it, vi } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { AuditActions } from "@/domain/audit/types";
import {
  COMPLIANCE_NOTE_REQUIRED,
  COMPLIANCE_NOTES_FORBIDDEN,
  COMPLIANCE_STATUS_FORBIDDEN,
} from "@/domain/compliance/types";
import { addComplianceNote, updateComplianceStatus } from "@/server/compliance/compliance-service";

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

function invoiceRecord(complianceStatus: "NOT_REVIEWED" | "UNDER_REVIEW" | "APPROVED" | "FLAGGED") {
  return {
    id: invoiceId,
    companyId,
    customerId: "55555555-5555-4555-8555-555555555555",
    invoiceNumber: "INV-1",
    invoiceDate: new Date(),
    dueDate: new Date(),
    currencyCode: "USD",
    referencePo: null,
    assignedStaffUserId: null,
    status: "ISSUED" as const,
    complianceStatus,
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
  };
}

function emptyStore() {
  return {
    createReview: vi.fn(),
    listReviews: vi.fn(),
    updateInvoiceComplianceStatus: vi.fn(),
    updatePaymentComplianceStatus: vi.fn(),
    updateCustomerComplianceStatus: vi.fn(),
    listQueue: vi.fn(),
  };
}

describe("compliance status update authorization (TASK-071 / TASK-073)", () => {
  it("denies Staff with 403", async () => {
    const result = await updateComplianceStatus(
      principal("STAFF"),
      {
        subjectType: "INVOICE",
        subjectId: invoiceId,
        status: "UNDER_REVIEW",
      },
      {
        store: emptyStore(),
        invoices: { getInvoiceById: vi.fn() },
        payments: { getPaymentById: vi.fn() },
        customers: { getCustomerById: vi.fn() },
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toBe(COMPLIANCE_STATUS_FORBIDDEN);
    }
  });

  it("allows Admin to approve with notes/reason and write audit payload fields", async () => {
    const createReview = vi.fn().mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
      companyId,
      subjectType: "INVOICE",
      subjectId: invoiceId,
      status: "APPROVED",
      notes: "Looks clean",
      reason: "CLEAR",
      resolutionNotes: "No issues found",
      evidenceRefs: ["evidence/key-1"],
      reviewerUserId: principal("ADMIN").userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const updateInvoiceComplianceStatus = vi.fn().mockResolvedValue(undefined);
    const append = vi.fn().mockResolvedValue({ id: "audit" });

    const result = await updateComplianceStatus(
      principal("ADMIN"),
      {
        subjectType: "INVOICE",
        subjectId: invoiceId,
        status: "APPROVED",
        notes: "Looks clean",
        reason: "CLEAR",
        resolutionNotes: "No issues found",
        evidenceRefs: ["evidence/key-1"],
      },
      {
        store: {
          ...emptyStore(),
          createReview,
          updateInvoiceComplianceStatus,
        },
        invoices: {
          getInvoiceById: vi.fn().mockResolvedValue(invoiceRecord("NOT_REVIEWED")),
        },
        payments: { getPaymentById: vi.fn() },
        customers: { getCustomerById: vi.fn() },
        auditWriter: { append },
        enforceTransactionalCompanyScope: async () => ({ ok: true as const, data: true as const }),
      },
    );

    expect(result.ok).toBe(true);
    expect(updateInvoiceComplianceStatus).toHaveBeenCalledWith(invoiceId, "APPROVED", {
      updatedByUserId: principal("ADMIN").userId,
    });
    expect(createReview).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "APPROVED",
        notes: "Looks clean",
        reason: "CLEAR",
        resolutionNotes: "No issues found",
        evidenceRefs: ["evidence/key-1"],
      }),
    );
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditActions.COMPLIANCE_STATUS_UPDATED,
        reason: "CLEAR",
        newValues: expect.objectContaining({
          complianceStatus: "APPROVED",
          notes: "Looks clean",
          reason: "CLEAR",
          resolutionNotes: "No issues found",
        }),
      }),
    );
    if (result.ok) {
      expect(result.data.status).toBe("APPROVED");
      expect(result.data.previousStatus).toBe("NOT_REVIEWED");
      expect(result.data.review?.notes).toBe("Looks clean");
    }
  });

  it("allows Compliance role to flag with a reason code", async () => {
    const append = vi.fn().mockResolvedValue({ id: "audit" });
    const result = await updateComplianceStatus(
      principal("COMPLIANCE"),
      {
        subjectType: "INVOICE",
        subjectId: invoiceId,
        status: "FLAGGED",
        reason: "SUSPICIOUS_AMOUNT",
        notes: "Amount unusual for this customer",
      },
      {
        store: {
          ...emptyStore(),
          createReview: vi.fn().mockResolvedValue({
            id: "66666666-6666-4666-8666-666666666666",
            companyId,
            subjectType: "INVOICE",
            subjectId: invoiceId,
            status: "FLAGGED",
            notes: "Amount unusual for this customer",
            reason: "SUSPICIOUS_AMOUNT",
            resolutionNotes: null,
            evidenceRefs: null,
            reviewerUserId: principal("COMPLIANCE").userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
          updateInvoiceComplianceStatus: vi.fn(),
        },
        invoices: {
          getInvoiceById: vi.fn().mockResolvedValue(invoiceRecord("UNDER_REVIEW")),
        },
        payments: { getPaymentById: vi.fn() },
        customers: { getCustomerById: vi.fn() },
        auditWriter: { append },
        enforceTransactionalCompanyScope: async () => ({ ok: true as const, data: true as const }),
      },
    );

    expect(result.ok).toBe(true);
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditActions.COMPLIANCE_STATUS_UPDATED,
        reason: "SUSPICIOUS_AMOUNT",
      }),
    );
  });
});

describe("compliance notes API (TASK-073)", () => {
  it("denies Staff adding notes", async () => {
    const result = await addComplianceNote(
      principal("STAFF"),
      {
        subjectType: "INVOICE",
        subjectId: invoiceId,
        notes: "Should not work",
      },
      {
        store: emptyStore(),
        invoices: { getInvoiceById: vi.fn() },
        payments: { getPaymentById: vi.fn() },
        customers: { getCustomerById: vi.fn() },
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toBe(COMPLIANCE_NOTES_FORBIDDEN);
    }
  });

  it("requires note, reason, or resolution content", async () => {
    const result = await addComplianceNote(
      principal("ADMIN"),
      {
        subjectType: "INVOICE",
        subjectId: invoiceId,
      },
      {
        store: emptyStore(),
        invoices: { getInvoiceById: vi.fn() },
        payments: { getPaymentById: vi.fn() },
        customers: { getCustomerById: vi.fn() },
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toBe(COMPLIANCE_NOTE_REQUIRED);
    }
  });

  it("adds a note without changing status and writes audit", async () => {
    const createReview = vi.fn().mockResolvedValue({
      id: "77777777-7777-4777-8777-777777777777",
      companyId,
      subjectType: "INVOICE",
      subjectId: invoiceId,
      status: "UNDER_REVIEW",
      notes: "Called customer",
      reason: "FOLLOW_UP",
      resolutionNotes: null,
      evidenceRefs: null,
      reviewerUserId: principal("ADMIN").userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const updateInvoiceComplianceStatus = vi.fn();
    const append = vi.fn().mockResolvedValue({ id: "audit" });

    const result = await addComplianceNote(
      principal("ADMIN"),
      {
        subjectType: "INVOICE",
        subjectId: invoiceId,
        notes: "Called customer",
        reason: "FOLLOW_UP",
      },
      {
        store: {
          ...emptyStore(),
          createReview,
          updateInvoiceComplianceStatus,
        },
        invoices: {
          getInvoiceById: vi.fn().mockResolvedValue(invoiceRecord("UNDER_REVIEW")),
        },
        payments: { getPaymentById: vi.fn() },
        customers: { getCustomerById: vi.fn() },
        auditWriter: { append },
        enforceTransactionalCompanyScope: async () => ({ ok: true as const, data: true as const }),
      },
    );

    expect(result.ok).toBe(true);
    expect(updateInvoiceComplianceStatus).not.toHaveBeenCalled();
    expect(createReview).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "UNDER_REVIEW",
        notes: "Called customer",
        reason: "FOLLOW_UP",
      }),
    );
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditActions.COMPLIANCE_NOTE_ADDED,
        reason: "FOLLOW_UP",
      }),
    );
  });
});
