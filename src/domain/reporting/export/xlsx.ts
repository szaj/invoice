import * as XLSX from "xlsx";

import { buildFilterSummaryRows } from "@/domain/reporting/export/csv";
import type { ReportExportSheet } from "@/domain/reporting/export/types";

function sheetNameSafe(name: string, used: Set<string>): string {
  const base = name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Sheet";
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    const trimmed = base.slice(0, Math.max(1, 31 - String(suffix).length - 1));
    candidate = `${trimmed}_${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

export function buildXlsxFromSheets(
  sheets: readonly ReportExportSheet[],
  filters: Record<string, unknown> = {},
): Uint8Array {
  const workbook = XLSX.utils.book_new();
  const usedNames = new Set<string>();

  const filterRows = buildFilterSummaryRows(filters);
  if (filterRows.length > 0) {
    const filterSheet = XLSX.utils.aoa_to_sheet(filterRows);
    XLSX.utils.book_append_sheet(workbook, filterSheet, sheetNameSafe("Filters", usedNames));
  }

  for (const sheet of sheets) {
    const rows: string[][] = [Array.from(sheet.headers)];
    for (const row of sheet.rows) {
      rows.push(Array.from(row));
    }
    if (sheet.summaryRows && sheet.summaryRows.length > 0) {
      rows.push([]);
      rows.push(["Totals"]);
      for (const row of sheet.summaryRows) {
        rows.push(Array.from(row));
      }
    }
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetNameSafe(sheet.name, usedNames));
  }

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Uint8Array(buffer);
}
