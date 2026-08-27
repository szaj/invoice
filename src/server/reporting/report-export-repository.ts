import "server-only";

import type {
  ReportExportFormatWire,
  ReportExportRecord,
  ReportExportStatus,
  ReportExportType,
} from "@/domain/reporting/export/types";
import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/server/db/client";

function mapFormat(format: "CSV" | "XLSX"): ReportExportFormatWire {
  return format === "XLSX" ? "xlsx" : "csv";
}

function mapStatus(status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"): ReportExportStatus {
  return status;
}

function mapRow(row: {
  id: string;
  reportType: string;
  format: "CSV" | "XLSX";
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  storageKey: string | null;
  checksumSha256: string | null;
  byteSize: number | null;
  contentType: string | null;
  filename: string;
  filters: unknown;
  rowCount: number | null;
  totals: unknown;
  errorMessage: string | null;
  companyId: string | null;
  requestedByUserId: string;
  createdAt: Date;
  completedAt: Date | null;
}): ReportExportRecord {
  return {
    id: row.id,
    reportType: row.reportType as ReportExportType,
    format: mapFormat(row.format),
    status: mapStatus(row.status),
    storageKey: row.storageKey,
    checksumSha256: row.checksumSha256,
    byteSize: row.byteSize,
    contentType: row.contentType,
    filename: row.filename,
    filters:
      row.filters && typeof row.filters === "object" && !Array.isArray(row.filters)
        ? (row.filters as Record<string, unknown>)
        : {},
    rowCount: row.rowCount,
    totals:
      row.totals && typeof row.totals === "object" && !Array.isArray(row.totals)
        ? (row.totals as Record<string, unknown>)
        : null,
    errorMessage: row.errorMessage,
    companyId: row.companyId,
    requestedByUserId: row.requestedByUserId,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  };
}

export class PrismaReportExportStore {
  async createPending(input: {
    readonly reportType: ReportExportType;
    readonly format: ReportExportFormatWire;
    readonly filename: string;
    readonly filters: Record<string, unknown>;
    readonly companyId: string | null;
    readonly requestedByUserId: string;
  }): Promise<ReportExportRecord> {
    const prisma = getPrisma();
    const created = await prisma.reportExport.create({
      data: {
        reportType: input.reportType,
        format: input.format === "xlsx" ? "XLSX" : "CSV",
        status: "PENDING",
        filename: input.filename,
        filters: input.filters as Prisma.InputJsonValue,
        companyId: input.companyId,
        requestedByUserId: input.requestedByUserId,
      },
    });
    return mapRow(created);
  }

  async markProcessing(id: string): Promise<void> {
    const prisma = getPrisma();
    await prisma.reportExport.update({
      where: { id },
      data: { status: "PROCESSING" },
    });
  }

  async markCompleted(input: {
    readonly id: string;
    readonly storageKey: string;
    readonly checksumSha256: string;
    readonly byteSize: number;
    readonly contentType: string;
    readonly rowCount: number;
    readonly totals: Record<string, unknown>;
  }): Promise<ReportExportRecord> {
    const prisma = getPrisma();
    const updated = await prisma.reportExport.update({
      where: { id: input.id },
      data: {
        status: "COMPLETED",
        storageKey: input.storageKey,
        checksumSha256: input.checksumSha256,
        byteSize: input.byteSize,
        contentType: input.contentType,
        rowCount: input.rowCount,
        totals: input.totals as Prisma.InputJsonValue,
        completedAt: new Date(),
        errorMessage: null,
      },
    });
    return mapRow(updated);
  }

  async markFailed(id: string, errorMessage: string): Promise<ReportExportRecord> {
    const prisma = getPrisma();
    const updated = await prisma.reportExport.update({
      where: { id },
      data: {
        status: "FAILED",
        errorMessage,
        completedAt: new Date(),
      },
    });
    return mapRow(updated);
  }

  async getById(id: string): Promise<ReportExportRecord | null> {
    const prisma = getPrisma();
    const row = await prisma.reportExport.findUnique({ where: { id } });
    return row ? mapRow(row) : null;
  }
}
