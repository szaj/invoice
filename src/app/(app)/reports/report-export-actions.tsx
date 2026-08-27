"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { ReportExportType } from "@/domain/reporting/export/types";

function cleanFilters(filters: Record<string, string>): Record<string, string> {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value.trim() !== "") {
      cleaned[key] = value.trim();
    }
  }
  return cleaned;
}

/**
 * Server-side report export actions (TASK-090).
 * Visible only when the caller already gated report.export.
 */
export function ReportExportActions({
  reportType,
  filters,
}: {
  reportType: ReportExportType;
  filters: Record<string, string>;
}) {
  const [busyFormat, setBusyFormat] = useState<"csv" | "xlsx" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runExport(format: "csv" | "xlsx") {
    setBusyFormat(format);
    setError(null);
    try {
      const response = await fetch("/api/reports/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType,
          format,
          filters: cleanFilters(filters),
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        export?: { id: string; status: string };
      };
      if (!response.ok || !payload.ok || !payload.export?.id) {
        setError(payload.error ?? "Export failed.");
        return;
      }
      if (payload.export.status !== "COMPLETED") {
        setError("Export is not ready yet. Try again in a moment.");
        return;
      }
      const link = document.createElement("a");
      link.href = `/api/reports/exports/${payload.export.id}/file`;
      link.rel = "noopener";
      document.body.append(link);
      link.click();
      link.remove();
    } catch {
      setError("Export failed.");
    } finally {
      setBusyFormat(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busyFormat !== null}
          onClick={() => void runExport("csv")}
        >
          {busyFormat === "csv" ? "Exporting…" : "Export CSV"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busyFormat !== null}
          onClick={() => void runExport("xlsx")}
        >
          {busyFormat === "xlsx" ? "Exporting…" : "Export XLSX"}
        </Button>
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
