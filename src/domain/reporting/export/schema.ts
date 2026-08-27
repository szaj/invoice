import { z } from "zod";

import {
  REPORT_EXPORT_FORMATS,
  REPORT_EXPORT_TYPES,
  type ReportExportFormatWire,
  type ReportExportType,
} from "@/domain/reporting/export/types";

export const reportExportRequestSchema = z.strictObject({
  reportType: z.enum(REPORT_EXPORT_TYPES),
  format: z.enum(REPORT_EXPORT_FORMATS).default("csv"),
  filters: z.record(z.string(), z.unknown()).default({}),
});

export type ReportExportRequest = z.infer<typeof reportExportRequestSchema>;

export function parseReportExportRequest(value: unknown): ReportExportRequest | null {
  const parsed = reportExportRequestSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : null;
}

export function isReportExportType(value: string): value is ReportExportType {
  return (REPORT_EXPORT_TYPES as readonly string[]).includes(value);
}

export function isReportExportFormat(value: string): value is ReportExportFormatWire {
  return (REPORT_EXPORT_FORMATS as readonly string[]).includes(value);
}
