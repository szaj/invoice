"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import type { InvoicePdfFileRecord } from "@/domain/invoices/pdf";
import type { InvoiceVersionRecord } from "@/domain/invoices/versions";
import { generateInvoicePdfAction } from "@/server/invoices/actions";

function formatWhen(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

export function InvoicePdfPanel({
  invoiceId,
  invoiceStatus,
  versions,
  initialFiles,
}: {
  invoiceId: string;
  invoiceStatus: string;
  versions: readonly InvoiceVersionRecord[];
  initialFiles: readonly InvoicePdfFileRecord[];
}) {
  const router = useRouter();
  const [files, setFiles] = useState(initialFiles);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(initialFiles[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const versionById = useMemo(() => {
    const map = new Map<string, InvoiceVersionRecord>();
    for (const version of versions) {
      map.set(version.id, version);
    }
    return map;
  }, [versions]);

  const selectedFile = files.find((file) => file.id === selectedFileId) ?? files[0] ?? null;
  const previewUrl = selectedFile
    ? `/api/invoices/${invoiceId}/pdf/files/${selectedFile.id}?disposition=inline`
    : null;
  const downloadUrl = selectedFile
    ? `/api/invoices/${invoiceId}/pdf/files/${selectedFile.id}?disposition=attachment`
    : null;

  const canGenerate = invoiceStatus !== "DRAFT" && versions.length > 0;

  function onPrint() {
    if (!previewUrl) {
      setError("A stored invoice PDF is required before print or export.");
      return;
    }
    setError(null);
    const printWindow = window.open(previewUrl, "_blank", "noopener,noreferrer");
    if (!printWindow) {
      setError("Pop-up blocked. Allow pop-ups to print, or use Download PDF.");
      return;
    }
    // Browser print against the stored PDF stream (TASK-043 / TASK-040).
    const attemptPrint = () => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch {
        // User can still print manually from the opened tab.
      }
    };
    printWindow.addEventListener("load", attemptPrint, { once: true });
    // Some browsers fire load before the listener attaches for cached PDFs.
    window.setTimeout(attemptPrint, 750);
  }

  function onGenerate() {
    setError(null);
    startTransition(async () => {
      const result = await generateInvoicePdfAction(invoiceId, {
        invoiceVersionId: versions[0]?.id ?? null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      // Reload file list from API so selection updates without full navigation state lag.
      try {
        const response = await fetch(`/api/invoices/${invoiceId}/pdf`, {
          credentials: "same-origin",
        });
        const body = (await response.json()) as {
          ok?: boolean;
          files?: InvoicePdfFileRecord[];
          error?: string;
        };
        if (!response.ok || !body.ok || !body.files) {
          setError(body.error ?? "Could not refresh PDF list.");
          return;
        }
        setFiles(body.files);
        setSelectedFileId(body.files[0]?.id ?? null);
      } catch {
        setError("Could not refresh PDF list.");
      }
    });
  }

  if (invoiceStatus === "DRAFT") {
    return (
      <Card>
        <CardHeader className="grid gap-1">
          <h2 className="text-base font-semibold">PDF</h2>
          <CardDescription>Issue the invoice to generate a stored PDF.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="grid gap-1">
        <h2 className="text-base font-semibold">PDF preview, download &amp; print</h2>
        <CardDescription>
          Stored versioned PDFs. Historical files are not rebuilt from today’s invoice or branding
          data. Print and download use the stored file (TASK-040/043).
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {files.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No PDF stored yet
            {canGenerate ? " — generate one from the latest invoice version." : "."}
          </p>
        ) : (
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Versioned PDF
              </span>
              <select
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                value={selectedFile?.id ?? ""}
                onChange={(event) => setSelectedFileId(event.target.value)}
              >
                {files.map((file) => {
                  const version = versionById.get(file.invoiceVersionId);
                  const label = version
                    ? `v${version.versionNo} · ${version.snapshot.invoiceNumber ?? "—"} · ${formatWhen(file.createdAt)}`
                    : `${file.id.slice(0, 8)} · ${formatWhen(file.createdAt)}`;
                  return (
                    <option key={file.id} value={file.id}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </label>

            {previewUrl ? (
              <iframe
                title="Invoice PDF preview"
                src={previewUrl}
                className="bg-muted h-[32rem] w-full rounded-md border"
              />
            ) : null}

            <div className="flex flex-wrap gap-2">
              {downloadUrl ? (
                <Button asChild variant="outline" data-testid="invoice-pdf-download">
                  <a href={downloadUrl} download>
                    Download PDF
                  </a>
                </Button>
              ) : null}
              {previewUrl ? (
                <Button
                  type="button"
                  variant="outline"
                  data-testid="invoice-pdf-print"
                  onClick={onPrint}
                >
                  Print
                </Button>
              ) : null}
              {previewUrl ? (
                <Button asChild variant="outline">
                  <a href={previewUrl} target="_blank" rel="noreferrer">
                    Open in new tab
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        )}

        {canGenerate ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={onGenerate} disabled={pending}>
              {pending
                ? "Working…"
                : files.length === 0
                  ? "Generate PDF"
                  : "Ensure latest version PDF"}
            </Button>
          </div>
        ) : null}

        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
