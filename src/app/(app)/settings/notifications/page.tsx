import { redirect } from "next/navigation";

import { NotificationSettingsForm } from "@/app/(app)/settings/notifications/notification-settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadNotificationSettingsForAdmin } from "@/server/settings/actions";

export const dynamic = "force-dynamic";

export default async function NotificationSettingsPage() {
  const result = await loadNotificationSettingsForAdmin();
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
        <h1 className="text-xl font-semibold">Notification settings</h1>
        <p className="text-muted-foreground text-sm">
          Enable or disable operational email alerts. Customer invoice templates continue to use
          their configured merge fields; this page controls internal staff notifications only.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Operational alerts</CardTitle>
          <CardDescription>
            Changes are audited. No customer portal notifications are sent from these toggles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationSettingsForm defaultValues={result.data} />
        </CardContent>
      </Card>
    </main>
  );
}
