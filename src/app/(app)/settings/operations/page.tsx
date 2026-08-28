import { redirect } from "next/navigation";

import { OperationsHealthPanel } from "@/app/(app)/settings/operations/operations-health-panel";
import { loadOperationalMonitoringForAdmin } from "@/server/monitoring/actions";

export const dynamic = "force-dynamic";

export default async function OperationsMonitoringPage() {
  const result = await loadOperationalMonitoringForAdmin();
  if (!result.ok) {
    if (result.status === 403) {
      redirect("/");
    }
    return (
      <main className="mx-auto max-w-5xl p-8">
        <p className="text-destructive text-sm">{result.error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-8">
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">Operations monitoring</h1>
        <p className="text-muted-foreground text-sm">
          Admin-only gateway configuration, adapter health, webhook failure indicators, and backup
          health. Use company gateway settings to resolve configuration errors.
        </p>
      </div>

      <OperationsHealthPanel snapshot={result.data} />
    </main>
  );
}
