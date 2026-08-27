import { describe, expect, it, vi } from "vitest";

import { AuditActions, AuditEntityTypes } from "@/domain/audit/types";
import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { roleHasPermission } from "@/domain/authz/matrix";
import { buildCsvFromSheets } from "@/domain/reporting/export/csv";
import { buildInvoiceReportExport } from "@/domain/reporting/export/builders";
import {
  REPORT_EXPORT_FORBIDDEN,
  REPORT_EXPORT_INVALID_INPUT,
  reportExportFilename,
} from "@/domain/reporting/export/types";
import type { InvoiceReportPayload } from "@/domain/reporting/types";
import {
  createReportExport,
  type ReportExportServiceDependencies,
} from "@/server/reporting/report-export-service";
import { MemoryStorageService } from "@/server/storage/memory-storage";
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

const invoicePayload: InvoiceReportPayload = {
  rows: [
    {
      id: "44444444-4444-4444-8444-444444444444",
      invoiceNumber: "INV-1",
      customerId: "55555555-5555-4555-8555-555555555555",
      customerDisplayName: "Acme",
      companyId: assignedCompanyId,
      companyDisplayName: "Brand A",
      invoiceDate: "2026-08-01",
      dueDate: "2026-09-01",
      currencyCode: "USD",
      invoiceTotal: "100.0000",
      confirmedPaidAmount: "0.0000",
      outstandingAmount: "100.0000",
      status: "ISSUED",
      assignedStaffUserId: null,
      assignedStaffName: null,
      decimalPrecision: 4,
    },
  ],
  page: 1,
  pageSize: 50,
  totalCount: 1,
  sortBy: "invoiceDate",
  sortDir: "desc",
};

function exportDeps() {
  const auditWriter = createMemoryAuditWriter();
  const storage = new MemoryStorageService();
  const store = {
    createPending: vi.fn(
      async (input: {
        reportType: string;
        format: "csv" | "xlsx";
        filename: string;
        filters: Record<string, unknown>;
        companyId: string | null;
        requestedByUserId: string;
      }) => ({
        id: "99999999-9999-4999-8999-999999999999",
        reportType: input.reportType as "invoices",
        format: input.format,
        status: "PENDING" as const,
        storageKey: null,
        checksumSha256: null,
        byteSize: null,
        contentType: null,
        filename: input.filename,
        filters: input.filters,
        rowCount: null,
        totals: null,
        errorMessage: null,
        companyId: input.companyId,
        requestedByUserId: input.requestedByUserId,
        createdAt: new Date("2026-08-27T00:00:00.000Z"),
        completedAt: null,
      }),
    ),
    markProcessing: vi.fn(async () => undefined),
    markCompleted: vi.fn(
      async (input: {
        id: string;
        storageKey: string;
        checksumSha256: string;
        byteSize: number;
        contentType: string;
        rowCount: number;
        totals: Record<string, unknown>;
      }) => ({
        id: input.id,
        reportType: "invoices" as const,
        format: "csv" as const,
        status: "COMPLETED" as const,
        storageKey: input.storageKey,
        checksumSha256: input.checksumSha256,
        byteSize: input.byteSize,
        contentType: input.contentType,
        filename: "invoices-report-2026-08-27.csv",
        filters: { companyId: assignedCompanyId },
        rowCount: input.rowCount,
        totals: input.totals,
        errorMessage: null,
        companyId: assignedCompanyId,
        requestedByUserId: "11111111-1111-4111-8111-111111111111",
        createdAt: new Date("2026-08-27T00:00:00.000Z"),
        completedAt: new Date("2026-08-27T00:00:01.000Z"),
      }),
    ),
    markFailed: vi.fn(),
    getById: vi.fn(async () => ({
      id: "99999999-9999-4999-8999-999999999999",
      reportType: "invoices" as const,
      format: "csv" as const,
      status: "COMPLETED" as const,
      storageKey: "report-exports/test/invoices-report-2026-08-27.csv",
      checksumSha256: "abc",
      byteSize: 10,
      contentType: "text/csv; charset=utf-8",
      filename: "invoices-report-2026-08-27.csv",
      filters: { companyId: assignedCompanyId },
      rowCount: 1,
      totals: { totalCount: 1 },
      errorMessage: null,
      companyId: assignedCompanyId,
      requestedByUserId: "11111111-1111-4111-8111-111111111111",
      createdAt: new Date("2026-08-27T00:00:00.000Z"),
      completedAt: new Date("2026-08-27T00:00:01.000Z"),
    })),
  };

  return {
    auditWriter,
    storage,
    deps: {
      store,
      storage,
      auditWriter,
      dispatcher: {
        dispatch: vi.fn(async (job: { exportId: string }) => {
          const built = buildInvoiceReportExport(invoicePayload);
          const bytes = new TextEncoder().encode(
            buildCsvFromSheets(built.sheets, { companyId: assignedCompanyId }),
          );
          const storageKey = `report-exports/${job.exportId}/invoices-report-2026-08-27.csv`;
          await storage.putObject({
            key: storageKey,
            body: bytes,
            contentType: "text/csv; charset=utf-8",
          });
          await store.markCompleted({
            id: job.exportId,
            storageKey,
            checksumSha256: "abc",
            byteSize: bytes.byteLength,
            contentType: "text/csv; charset=utf-8",
            rowCount: built.rowCount,
            totals: built.totals,
          });
          await auditWriter.append({
            actorType: "USER",
            actorUserId: "11111111-1111-4111-8111-111111111111",
            companyId: assignedCompanyId,
            entityType: AuditEntityTypes.REPORT_EXPORT,
            entityId: job.exportId,
            action: AuditActions.REPORT_EXPORTED,
            newValues: {
              reportType: "invoices",
              format: "csv",
              rowCount: built.rowCount,
            },
          });
        }),
      },
    },
  };
}

describe("report export (TASK-090)", () => {
  it("grants Admin/Compliance report.export and denies Staff by default (US-009)", () => {
    expect(roleHasPermission("ADMIN", "report.export")).toBe(true);
    expect(roleHasPermission("COMPLIANCE", "report.export")).toBe(true);
    expect(roleHasPermission("STAFF", "report.export")).toBe(false);
  });

  it("denies Staff with 403 and does not create export rows", async () => {
    const { deps, auditWriter } = exportDeps();
    const result = await createReportExport(
      principal("STAFF"),
      { reportType: "invoices", format: "csv", filters: {} },
      deps as ReportExportServiceDependencies,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toBe(REPORT_EXPORT_FORBIDDEN);
    }
    expect(deps.store.createPending).not.toHaveBeenCalled();
    expect(auditWriter.events).toHaveLength(0);
  });

  it("creates export job metadata and audits successful export", async () => {
    const { deps, auditWriter } = exportDeps();
    const result = await createReportExport(
      principal("ADMIN"),
      {
        reportType: "invoices",
        format: "csv",
        filters: { companyId: assignedCompanyId },
      },
      deps as ReportExportServiceDependencies,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("export failed");
    }
    expect(result.data.status).toBe("COMPLETED");
    expect(deps.store.createPending).toHaveBeenCalled();
    expect(deps.dispatcher.dispatch).toHaveBeenCalled();
    expect(auditWriter.events).toHaveLength(1);
    expect(auditWriter.events[0]?.action).toBe(AuditActions.REPORT_EXPORTED);
    expect(auditWriter.events[0]?.entityType).toBe(AuditEntityTypes.REPORT_EXPORT);
  });

  it("rejects invalid export requests", async () => {
    const { deps } = exportDeps();
    const result = await createReportExport(
      principal("ADMIN"),
      { reportType: "not-a-report", format: "csv", filters: {} },
      deps as ReportExportServiceDependencies,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toBe(REPORT_EXPORT_INVALID_INPUT);
    }
  });

  it("builds invoice CSV with filters and totals", () => {
    const built = buildInvoiceReportExport(invoicePayload);
    const csv = buildCsvFromSheets(built.sheets, { companyId: assignedCompanyId });
    expect(csv).toContain("# Filters");
    expect(csv).toContain("invoiceId,invoiceNumber");
    expect(csv).toContain("INV-1");
    expect(csv).toContain("# Totals");
    expect(reportExportFilename("invoices", "csv", new Date("2026-08-27T12:00:00.000Z"))).toBe(
      "invoices-report-2026-08-27.csv",
    );
  });
});
