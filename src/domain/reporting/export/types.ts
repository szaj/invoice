export const REPORT_EXPORT_TYPES = [
  "invoices",
  "payments",
  "outstanding",
  "overdue-aging",
  "customers",
  "companies",
  "staff",
  "gateways",
  "currencies",
  "compliance-report",
  "monthly-brand",
  "reporting-groups",
] as const;

export type ReportExportType = (typeof REPORT_EXPORT_TYPES)[number];

export const REPORT_EXPORT_FORMATS = ["csv", "xlsx"] as const;
export type ReportExportFormatWire = (typeof REPORT_EXPORT_FORMATS)[number];

export const REPORT_EXPORT_STATUSES = ["PENDING", "PROCESSING", "COMPLETED", "FAILED"] as const;
export type ReportExportStatus = (typeof REPORT_EXPORT_STATUSES)[number];

export const REPORT_EXPORT_CONTENT_TYPES = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

export const REPORT_EXPORT_FORBIDDEN = "You do not have permission to export reports.";
export const REPORT_EXPORT_INVALID_INPUT = "Check the export request and try again.";
export const REPORT_EXPORT_UNAVAILABLE = "Report export is temporarily unavailable.";
export const REPORT_EXPORT_NOT_FOUND = "Report export not found.";
export const REPORT_EXPORT_NOT_READY = "Report export is not ready for download.";

/** Maximum rows fetched server-side for a single export job. */
export const REPORT_EXPORT_MAX_ROWS = 100_000;

export type ReportExportSheet = {
  readonly name: string;
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
  readonly summaryRows?: readonly (readonly string[])[];
};

export type ReportExportBuildResult = {
  readonly sheets: readonly ReportExportSheet[];
  readonly rowCount: number;
  readonly totals: Record<string, unknown>;
};

export type ReportExportRecord = {
  readonly id: string;
  readonly reportType: ReportExportType;
  readonly format: ReportExportFormatWire;
  readonly status: ReportExportStatus;
  readonly storageKey: string | null;
  readonly checksumSha256: string | null;
  readonly byteSize: number | null;
  readonly contentType: string | null;
  readonly filename: string;
  readonly filters: Record<string, unknown>;
  readonly rowCount: number | null;
  readonly totals: Record<string, unknown> | null;
  readonly errorMessage: string | null;
  readonly companyId: string | null;
  readonly requestedByUserId: string;
  readonly createdAt: Date;
  readonly completedAt: Date | null;
};

export function reportExportFilename(
  reportType: ReportExportType,
  format: ReportExportFormatWire,
  now: Date = new Date(),
): string {
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const ext = format === "xlsx" ? "xlsx" : "csv";
  return `${reportType}-report-${yyyy}-${mm}-${dd}.${ext}`;
}

export function reportExportStorageKey(exportId: string, filename: string): string {
  return `report-exports/${exportId}/${filename}`;
}
