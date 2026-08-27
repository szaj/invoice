import { describe, expect, it, vi } from "vitest";

import { AuditActions, AuditEntityTypes } from "@/domain/audit/types";
import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { roleHasPermission } from "@/domain/authz/matrix";
import { buildComplianceExportCsv, complianceExportFilename } from "@/domain/compliance/export-csv";
import {
  COMPLIANCE_EXPORT_FORBIDDEN,
  COMPLIANCE_INVALID_INPUT,
  type ComplianceQueueItem,
} from "@/domain/compliance/types";
import { exportComplianceReport } from "@/server/compliance/compliance-service";
import { createMemoryAuditWriter } from "../helpers/memory-audit-writer";

const assignedCompanyId = "22222222-2222-4222-8222-222222222222";

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
    complianceStatus: "FLAGGED",
    staffUserId: null,
    date: new Date("2026-08-01T00:00:00.000Z"),
    amount: "100.0000",
    currencyCode: "USD",
    gateway: null,
    label: 'INV-1, "quoted"',
    customerId: "55555555-5555-4555-8555-555555555555",
    invoiceId: "44444444-4444-4444-8444-444444444444",
    ...overrides,
  };
}

function exportDeps(listQueue = vi.fn().mockResolvedValue([queueItem()])) {
  const auditWriter = createMemoryAuditWriter();
  return {
    listQueue,
    auditWriter,
    deps: {
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
      auditWriter,
    },
  };
}

describe("compliance export (TASK-075)", () => {
  it("grants Admin/Compliance report.export and denies Staff by default (US-009)", () => {
    expect(roleHasPermission("ADMIN", "report.export")).toBe(true);
    expect(roleHasPermission("COMPLIANCE", "report.export")).toBe(true);
    expect(roleHasPermission("STAFF", "report.export")).toBe(false);
  });

  it("denies Staff with 403 and does not list or audit", async () => {
    const { listQueue, auditWriter, deps } = exportDeps();
    const result = await exportComplianceReport(principal("STAFF"), {}, deps);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toBe(COMPLIANCE_EXPORT_FORBIDDEN);
    }
    expect(listQueue).not.toHaveBeenCalled();
    expect(auditWriter.events).toHaveLength(0);
  });

  it("exports CSV, scopes Compliance to assigned companies, and audits export", async () => {
    const { listQueue, auditWriter, deps } = exportDeps();
    const result = await exportComplianceReport(
      principal("COMPLIANCE"),
      { status: "FLAGGED", companyId: assignedCompanyId },
      deps,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("export failed");
    }
    expect(result.data.contentType).toBe("text/csv; charset=utf-8");
    expect(result.data.filename).toMatch(/^compliance-export-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(result.data.rowCount).toBe(1);
    expect(listQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        companyIds: [assignedCompanyId],
        status: "FLAGGED",
      }),
    );

    const text = new TextDecoder().decode(result.data.bytes);
    expect(text).toContain("subjectType,subjectId,companyId");
    expect(text).toContain('"INV-1, ""quoted"""');

    expect(auditWriter.events).toHaveLength(1);
    expect(auditWriter.events[0]?.action).toBe(AuditActions.COMPLIANCE_EXPORTED);
    expect(auditWriter.events[0]?.entityType).toBe(AuditEntityTypes.COMPLIANCE_EXPORT);
    expect(auditWriter.events[0]?.newValues).toEqual(
      expect.objectContaining({
        format: "csv",
        rowCount: 1,
        filters: expect.objectContaining({
          status: "FLAGGED",
          companyId: assignedCompanyId,
        }),
      }),
    );
  });

  it("rejects invalid filters", async () => {
    const { listQueue, deps } = exportDeps();
    const result = await exportComplianceReport(principal("ADMIN"), { status: "NOPE" }, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toBe(COMPLIANCE_INVALID_INPUT);
    }
    expect(listQueue).not.toHaveBeenCalled();
  });

  it("builds CSV headers and escapes fields", () => {
    const csv = buildComplianceExportCsv([queueItem()]);
    expect(csv.startsWith("subjectType,subjectId,companyId")).toBe(true);
    expect(csv).toContain('"INV-1, ""quoted"""');
    expect(complianceExportFilename(new Date("2026-08-27T12:00:00.000Z"))).toBe(
      "compliance-export-2026-08-27.csv",
    );
  });
});
