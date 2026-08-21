import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import type { InvoiceVersionRecord } from "@/domain/invoices/versions";

function formatWhen(value: Date): string {
  return value.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

export function InvoiceVersionHistoryPanel({
  versions,
}: {
  versions: readonly InvoiceVersionRecord[];
}) {
  return (
    <Card>
      <CardHeader className="grid gap-1">
        <h2 className="text-base font-semibold">Version history</h2>
        <CardDescription>
          Immutable snapshots created on issue. Historical versions are never overwritten. Issued
          financial revision policy remains open (ADR-009).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {versions.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No versions yet. A snapshot is created when the invoice is issued.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 pr-4 font-medium">Version</th>
                  <th className="py-2 pr-4 font-medium">Number</th>
                  <th className="py-2 pr-4 font-medium">Total</th>
                  <th className="py-2 pr-4 font-medium">Reason</th>
                  <th className="py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((version) => (
                  <tr key={version.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">v{version.versionNo}</td>
                    <td className="py-2 pr-4">{version.snapshot.invoiceNumber ?? "—"}</td>
                    <td className="py-2 pr-4">
                      {version.snapshot.invoiceTotal} {version.snapshot.currencyCode}
                    </td>
                    <td className="py-2 pr-4">{version.reason ?? "—"}</td>
                    <td className="py-2">{formatWhen(version.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
