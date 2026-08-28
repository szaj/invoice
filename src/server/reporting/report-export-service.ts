import "server-only";

import { createHash } from "node:crypto";

import { logger } from "@/lib/logger";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import { AuthorizationError } from "@/domain/authz/errors";
import { AuditActions, AuditEntityTypes, type AuditJson } from "@/domain/audit/types";
import { buildCsvFromSheets } from "@/domain/reporting/export/csv";
import { reportExportRequestSchema } from "@/domain/reporting/export/schema";
import { buildXlsxFromSheets } from "@/domain/reporting/export/xlsx";
import {
  REPORT_EXPORT_CONTENT_TYPES,
  REPORT_EXPORT_FORBIDDEN,
  REPORT_EXPORT_INVALID_INPUT,
  REPORT_EXPORT_NOT_FOUND,
  REPORT_EXPORT_NOT_READY,
  REPORT_EXPORT_UNAVAILABLE,
  reportExportFilename,
  reportExportStorageKey,
  type ReportExportRecord,
  type ReportExportType,
} from "@/domain/reporting/export/types";
import {
  getAuditWriter,
  recordAuditEventRequired,
  type AuditWriter,
} from "@/server/audit/audit-service";
import { createStorageService } from "@/server/storage/create-storage-service";
import type { StorageService } from "@/server/storage/storage-service";
import { loadReportExportData } from "@/server/reporting/report-export-data";
import {
  InlineReportExportJobDispatcher,
  type ReportExportJob,
  type ReportExportJobDispatcher,
} from "@/server/reporting/report-export-queue";
import { PrismaReportExportStore } from "@/server/reporting/report-export-repository";
import { isQueueEnabled } from "@/server/queue/config";
import { createReportExportBullMqDispatcher } from "@/server/queue/dispatchers";

export type ReportExportServiceResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 401 | 403 | 404 | 503; error: string };

export interface ReportExportServiceDependencies {
  readonly store?: Pick<
    PrismaReportExportStore,
    "createPending" | "markProcessing" | "markCompleted" | "markFailed" | "getById"
  >;
  readonly storage?: StorageService;
  readonly auditWriter?: AuditWriter;
  readonly dispatcher?: ReportExportJobDispatcher;
}

function storeOf(
  deps: ReportExportServiceDependencies,
): Pick<
  PrismaReportExportStore,
  "createPending" | "markProcessing" | "markCompleted" | "markFailed" | "getById"
> {
  return deps.store ?? new PrismaReportExportStore();
}

function storageOf(deps: ReportExportServiceDependencies): StorageService {
  return deps.storage ?? createStorageService();
}

function auditWriterOf(deps: ReportExportServiceDependencies): AuditWriter {
  return deps.auditWriter ?? getAuditWriter();
}

function dispatcherOf(deps: ReportExportServiceDependencies): ReportExportJobDispatcher {
  if (deps.dispatcher) {
    return deps.dispatcher;
  }
  if (isQueueEnabled()) {
    return createReportExportBullMqDispatcher();
  }
  return new InlineReportExportJobDispatcher((job) => processReportExportJob(job, deps));
}

function assertExportPermission(
  actor: AuthorizationPrincipal | null,
  reportType: ReportExportType,
): void {
  assertPermission(actor, "report.export");
  if (!actor) {
    throw new AuthorizationError("unauthenticated");
  }
  if (reportType === "compliance-report") {
    assertPermission(actor, "compliance.review");
  }
}

function companyIdFromFilters(filters: Record<string, unknown>): string | null {
  const value = filters.companyId;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function auditJsonValue(value: Record<string, unknown>): AuditJson {
  return JSON.parse(JSON.stringify(value)) as AuditJson;
}

function serializeExportFilters(filters: Record<string, unknown>): Record<string, unknown> {
  const serialized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (typeof value === "string" && value.trim() === "") {
      continue;
    }
    serialized[key] = value;
  }
  return serialized;
}

export function createDefaultReportExportServiceDependencies(): ReportExportServiceDependencies {
  return {
    store: new PrismaReportExportStore(),
  };
}

export async function processReportExportJob(
  job: ReportExportJob,
  deps: ReportExportServiceDependencies,
): Promise<void> {
  await storeOf(deps).markProcessing(job.exportId);

  try {
    const loaded = await loadReportExportData(
      job.actor,
      job.reportType as ReportExportType,
      job.filters,
    );
    if (!loaded.ok) {
      await storeOf(deps).markFailed(job.exportId, loaded.error);
      return;
    }

    const bytes =
      job.format === "xlsx"
        ? buildXlsxFromSheets(loaded.data.sheets, job.filters)
        : new TextEncoder().encode(buildCsvFromSheets(loaded.data.sheets, job.filters));

    const record = await storeOf(deps).getById(job.exportId);
    const filename =
      record?.filename ?? reportExportFilename(job.reportType as ReportExportType, job.format);
    const storageKey = reportExportStorageKey(job.exportId, filename);
    const contentType =
      job.format === "xlsx" ? REPORT_EXPORT_CONTENT_TYPES.xlsx : REPORT_EXPORT_CONTENT_TYPES.csv;
    const checksumSha256 = createHash("sha256").update(bytes).digest("hex");

    await storageOf(deps).putObject({
      key: storageKey,
      body: bytes,
      contentType,
    });

    const completed = await storeOf(deps).markCompleted({
      id: job.exportId,
      storageKey,
      checksumSha256,
      byteSize: bytes.byteLength,
      contentType,
      rowCount: loaded.data.rowCount,
      totals: loaded.data.totals,
    });

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: job.actor.userId,
        companyId: job.companyId,
        entityType: AuditEntityTypes.REPORT_EXPORT,
        entityId: completed.id,
        action: AuditActions.REPORT_EXPORTED,
        oldValues: null,
        newValues: {
          reportType: job.reportType,
          format: job.format,
          rowCount: loaded.data.rowCount,
          filters: auditJsonValue(serializeExportFilters(job.filters)),
        },
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "report.exported",
        exportId: completed.id,
        reportType: job.reportType,
        format: job.format,
        rowCount: loaded.data.rowCount,
      },
      "Report export completed",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    await storeOf(deps).markFailed(job.exportId, message);
    logger.error(
      {
        event: "report.export_failed",
        exportId: job.exportId,
        err: message,
      },
      "Report export failed",
    );
  }
}

/**
 * Create and process a tabular report export (TASK-090).
 * Requires report.export; compliance-report also requires compliance.review.
 * Staff denied by default (US-009). Export is audited (BR-015).
 */
export async function createReportExport(
  actor: AuthorizationPrincipal | null,
  input: unknown,
  deps: ReportExportServiceDependencies = createDefaultReportExportServiceDependencies(),
): Promise<ReportExportServiceResult<ReportExportRecord>> {
  try {
    const parsed = reportExportRequestSchema.safeParse(input ?? {});
    if (!parsed.success) {
      return { ok: false, status: 400, error: REPORT_EXPORT_INVALID_INPUT };
    }

    assertExportPermission(actor, parsed.data.reportType);
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const filters = serializeExportFilters(parsed.data.filters);
    const companyId = companyIdFromFilters(filters);
    if (companyId) {
      assertCompanyAccess(actor, companyId);
    }

    const filename = reportExportFilename(parsed.data.reportType, parsed.data.format);
    const pending = await storeOf(deps).createPending({
      reportType: parsed.data.reportType,
      format: parsed.data.format,
      filename,
      filters,
      companyId,
      requestedByUserId: actor.userId,
    });

    await dispatcherOf(deps).dispatch({
      exportId: pending.id,
      reportType: parsed.data.reportType,
      format: parsed.data.format,
      filters,
      actor,
      companyId,
    });

    const latest = await storeOf(deps).getById(pending.id);
    if (!latest) {
      return { ok: false, status: 503, error: REPORT_EXPORT_UNAVAILABLE };
    }
    if (latest.status === "FAILED") {
      return { ok: false, status: 503, error: latest.errorMessage ?? REPORT_EXPORT_UNAVAILABLE };
    }

    return { ok: true, data: latest };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, status: 403, error: REPORT_EXPORT_FORBIDDEN };
    }
    logger.error(
      {
        event: "report.export_create_failed",
        err: error instanceof Error ? error.message : "unknown",
      },
      "Report export create failed",
    );
    return { ok: false, status: 503, error: REPORT_EXPORT_UNAVAILABLE };
  }
}

export async function getReportExport(
  actor: AuthorizationPrincipal | null,
  exportId: string,
  deps: ReportExportServiceDependencies = createDefaultReportExportServiceDependencies(),
): Promise<ReportExportServiceResult<ReportExportRecord>> {
  try {
    assertPermission(actor, "report.export");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const record = await storeOf(deps).getById(exportId);
    if (!record || record.requestedByUserId !== actor.userId) {
      return { ok: false, status: 404, error: REPORT_EXPORT_NOT_FOUND };
    }
    if (record.companyId) {
      assertCompanyAccess(actor, record.companyId);
    }

    return { ok: true, data: record };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, status: 403, error: REPORT_EXPORT_FORBIDDEN };
    }
    return { ok: false, status: 503, error: REPORT_EXPORT_UNAVAILABLE };
  }
}

export async function downloadReportExport(
  actor: AuthorizationPrincipal | null,
  exportId: string,
  deps: ReportExportServiceDependencies = createDefaultReportExportServiceDependencies(),
): Promise<
  ReportExportServiceResult<{
    readonly bytes: Uint8Array;
    readonly filename: string;
    readonly contentType: string;
    readonly record: ReportExportRecord;
  }>
> {
  const meta = await getReportExport(actor, exportId, deps);
  if (!meta.ok) {
    return meta;
  }

  const record = meta.data;
  if (record.status !== "COMPLETED" || !record.storageKey || !record.contentType) {
    return { ok: false, status: 404, error: REPORT_EXPORT_NOT_READY };
  }

  const object = await storageOf(deps).getObject(record.storageKey);
  if (!object) {
    return { ok: false, status: 404, error: REPORT_EXPORT_NOT_FOUND };
  }

  return {
    ok: true,
    data: {
      bytes: object.body,
      filename: record.filename,
      contentType: record.contentType,
      record,
    },
  };
}
