import Link from "next/link";

import { StatusBadge } from "@/components/data/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  ApplicationHealthCheck,
  GatewayOperationalHealth,
  OperationalMonitoringSnapshot,
} from "@/domain/monitoring/types";
import type { BackupHealthSnapshot } from "@/domain/backup/types";
import { WEBHOOK_FAILURE_LOOKBACK_HOURS } from "@/domain/monitoring/types";
import type { PaymentMethodCode } from "@/domain/settlement/types";

const METHOD_LABELS: Record<PaymentMethodCode, string> = {
  STRIPE: "Stripe",
  PAYPAL: "PayPal",
  BANK_PROCESSOR: "Bank processor",
  MANUAL: "Manual",
};

function ApplicationHealthSummary({ application }: { application: ApplicationHealthCheck }) {
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div className="grid gap-1">
        <dt className="text-muted-foreground">Application</dt>
        <dd>
          <StatusBadge status={application.status} />
        </dd>
      </div>
      <div className="grid gap-1">
        <dt className="text-muted-foreground">Database</dt>
        <dd>
          <StatusBadge status={application.database ? "HEALTHY" : "FAILED"} />
        </dd>
      </div>
      <div className="grid gap-1">
        <dt className="text-muted-foreground">Queue</dt>
        <dd>
          <StatusBadge
            status={application.queueConfigured ? "HEALTHY" : "DISABLED"}
            label={application.queueConfigured ? "Redis configured" : "Inline fallback"}
          />
        </dd>
      </div>
      <div className="grid gap-1">
        <dt className="text-muted-foreground">Sentry</dt>
        <dd>
          <StatusBadge
            status={application.sentryConfigured ? "HEALTHY" : "DISABLED"}
            label={application.sentryConfigured ? "Configured" : "Not configured"}
          />
        </dd>
      </div>
    </dl>
  );
}

function BackupHealthSummary({ backup }: { backup: BackupHealthSnapshot }) {
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div className="grid gap-1">
        <dt className="text-muted-foreground">Database backups</dt>
        <dd>
          <StatusBadge status={backup.database.status} />
        </dd>
        {backup.database.lastSuccessAt ? (
          <dd className="text-muted-foreground text-xs">
            Last success: {new Date(backup.database.lastSuccessAt).toLocaleString()}
          </dd>
        ) : null}
        {backup.database.pitrRecommended ? (
          <dd className="text-muted-foreground text-xs">
            Production should enable Supabase point-in-time recovery (PITR) in addition to daily
            pg_dump artifacts.
          </dd>
        ) : null}
      </div>
      <div className="grid gap-1">
        <dt className="text-muted-foreground">Object storage</dt>
        <dd>
          <StatusBadge
            status={backup.objectStorage.status}
            label={
              backup.objectStorage.provider
                ? backup.objectStorage.provider
                : "Not configured"
            }
          />
        </dd>
        {backup.objectStorage.versioningEnabled != null ? (
          <dd className="text-muted-foreground text-xs">
            Versioning: {backup.objectStorage.versioningEnabled ? "enabled" : "disabled"}
          </dd>
        ) : backup.objectStorage.provider === "R2" ? (
          <dd className="text-muted-foreground text-xs">Versioning status unavailable</dd>
        ) : null}
      </div>
      <div className="grid gap-1 sm:col-span-2">
        <dt className="text-muted-foreground">Policy</dt>
        <dd className="text-muted-foreground text-xs">
          Daily automated pg_dump when <code className="text-xs">BACKUP_DIR</code> is configured.
          Artifacts exclude environment files and secrets. Restore scripts refuse production unless{" "}
          <code className="text-xs">BACKUP_RESTORE_ALLOW_PRODUCTION=true</code>. See Backup and
          Recovery runbook.
        </dd>
      </div>
    </dl>
  );
}

function GatewayHealthTable({ gateways }: { gateways: readonly GatewayOperationalHealth[] }) {
  const visibleGateways = gateways.filter(
    (row) => row.methodEnabled || row.configStatus !== "DISABLED" || row.recentWebhookFailures > 0,
  );

  if (visibleGateways.length === 0) {
    return <p className="text-muted-foreground text-sm">No enabled gateway configurations yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[56rem] text-left text-sm">
        <thead className="text-muted-foreground border-b text-xs uppercase">
          <tr>
            <th className="py-2 pr-4 font-medium">Company</th>
            <th className="px-4 py-2 font-medium">Method</th>
            <th className="px-4 py-2 font-medium">Config</th>
            <th className="px-4 py-2 font-medium">Adapter</th>
            <th className="px-4 py-2 font-medium">Webhooks</th>
            <th className="py-2 pl-4 font-medium">Recent failures</th>
          </tr>
        </thead>
        <tbody>
          {visibleGateways.map((row) => (
            <tr key={`${row.companyId}-${row.methodCode}`} className="border-b last:border-0">
              <td className="py-3 pr-4">
                <Link
                  href={`/companies/${row.companyId}/gateways`}
                  className="text-primary hover:underline"
                >
                  {row.companyDisplayName}
                </Link>
              </td>
              <td className="px-4 py-3">{METHOD_LABELS[row.methodCode]}</td>
              <td className="px-4 py-3">
                <StatusBadge status={row.configStatus} />
              </td>
              <td className="px-4 py-3">
                {row.adapterStatus ? (
                  <StatusBadge status={row.adapterStatus} />
                ) : (
                  <span className="text-muted-foreground">N/A</span>
                )}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={row.webhookStatus} />
              </td>
              <td className="py-3 pl-4">
                {row.recentWebhookFailures > 0 ? (
                  <span className="text-destructive font-medium">{row.recentWebhookFailures}</span>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
                {row.lastWebhookFailureAt ? (
                  <p className="text-muted-foreground text-xs">
                    Last: {new Date(row.lastWebhookFailureAt).toLocaleString()}
                  </p>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OperationsHealthPanel({ snapshot }: { snapshot: OperationalMonitoringSnapshot }) {
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platform health</CardTitle>
          <CardDescription>
            Load-balancer checks use <code className="text-xs">/api/health</code>. Exceptions are
            reported to Sentry when configured. Payment credentials are never sent to Sentry.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ApplicationHealthSummary application={snapshot.application} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Backup and recovery</CardTitle>
          <CardDescription>
            Database dumps run via <code className="text-xs">pnpm backup:database</code> (cron on
            the VPS). PDFs and exports rely on Cloudflare R2 object versioning in staging and
            production. Backup storage must remain Admin-restricted and must never contain plaintext
            secrets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BackupHealthSummary backup={snapshot.backup} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gateway and webhook health</CardTitle>
          <CardDescription>
            Adapter checks use provider <code className="text-xs">healthCheck()</code> without
            decrypting credentials. Webhook failures count events marked FAILED in the last{" "}
            {WEBHOOK_FAILURE_LOOKBACK_HOURS} hours. Gateway failure alerts email Admins when enabled
            under notification settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GatewayHealthTable gateways={snapshot.gateways} />
        </CardContent>
      </Card>
    </div>
  );
}
