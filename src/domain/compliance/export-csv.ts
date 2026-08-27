import type { ComplianceQueueItem } from "@/domain/compliance/types";

const CSV_HEADERS = [
  "subjectType",
  "subjectId",
  "companyId",
  "complianceStatus",
  "staffUserId",
  "date",
  "amount",
  "currencyCode",
  "gateway",
  "label",
  "customerId",
  "invoiceId",
] as const;

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function cell(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  return escapeCsvField(value);
}

function dateCell(value: Date | null): string {
  if (!value) {
    return "";
  }
  return escapeCsvField(value.toISOString());
}

/**
 * Build a CSV document from compliance queue rows (TASK-075).
 * CSV is the Version 1 tabular export format ([[Dashboard and Reporting]] §13.5).
 */
export function buildComplianceExportCsv(items: readonly ComplianceQueueItem[]): string {
  const lines: string[] = [CSV_HEADERS.join(",")];
  for (const item of items) {
    lines.push(
      [
        cell(item.subjectType),
        cell(item.subjectId),
        cell(item.companyId),
        cell(item.complianceStatus),
        cell(item.staffUserId),
        dateCell(item.date),
        cell(item.amount),
        cell(item.currencyCode),
        cell(item.gateway),
        cell(item.label),
        cell(item.customerId),
        cell(item.invoiceId),
      ].join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}

export function complianceExportFilename(now: Date = new Date()): string {
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `compliance-export-${yyyy}-${mm}-${dd}.csv`;
}
