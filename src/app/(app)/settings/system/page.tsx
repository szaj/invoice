import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SystemSettingsForm } from "@/app/(app)/settings/system/system-settings-form";
import { loadSystemSettingsForAdmin } from "@/server/settings/actions";

export const dynamic = "force-dynamic";

export default async function SystemSettingsPage() {
  const result = await loadSystemSettingsForAdmin();
  if (!result.ok) {
    if (result.status === 403) {
      redirect("/");
    }
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p className="text-destructive text-sm">{result.error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">System settings</h1>
        <p className="text-muted-foreground text-sm">
          Core platform defaults for later reporting and money utilities. Fixed conversion rates and
          gateway credentials are configured elsewhere.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Defaults</CardTitle>
          <CardDescription>
            Changes are audited. Secrets must not be stored in system settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SystemSettingsForm
            defaultValues={{
              reportingCurrencyCode: result.data.reportingCurrencyCode,
              defaultTimezone: result.data.defaultTimezone,
              roundingTolerance: result.data.roundingTolerance,
            }}
          />
        </CardContent>
      </Card>
    </main>
  );
}
