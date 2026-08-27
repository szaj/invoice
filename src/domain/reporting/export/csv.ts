import type { ReportExportSheet } from "@/domain/reporting/export/types";

export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  return escapeCsvField(String(value));
}

export function buildFilterSummaryRows(filters: Record<string, unknown>): string[][] {
  const rows: string[][] = [["# Filters"]];
  const entries = Object.entries(filters).filter(([, value]) => {
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === "string" && value.trim() === "") {
      return false;
    }
    return true;
  });
  if (entries.length === 0) {
    rows.push(["(none)"]);
  } else {
    for (const [key, value] of entries) {
      rows.push([key, csvCell(typeof value === "object" ? JSON.stringify(value) : String(value))]);
    }
  }
  rows.push([]);
  return rows;
}

export function buildCsvFromSheets(
  sheets: readonly ReportExportSheet[],
  filters: Record<string, unknown> = {},
): string {
  const lines: string[] = [];
  for (const row of buildFilterSummaryRows(filters)) {
    lines.push(row.join(","));
  }

  for (let index = 0; index < sheets.length; index += 1) {
    const sheet = sheets[index]!;
    if (index > 0) {
      lines.push("");
    }
    if (sheets.length > 1) {
      lines.push(`# Sheet: ${sheet.name}`);
    }
    lines.push(sheet.headers.map((header) => csvCell(header)).join(","));
    for (const row of sheet.rows) {
      lines.push(row.map((cell) => csvCell(cell)).join(","));
    }
    if (sheet.summaryRows && sheet.summaryRows.length > 0) {
      lines.push("");
      lines.push("# Totals");
      for (const row of sheet.summaryRows) {
        lines.push(row.map((cell) => csvCell(cell)).join(","));
      }
    }
  }

  return `${lines.join("\r\n")}\r\n`;
}
