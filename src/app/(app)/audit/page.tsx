import Link from "next/link";
import { redirect } from "next/navigation";

import { AuditEventDetailButton } from "@/app/(app)/audit/audit-event-detail";
import { AuditLogFilters, type AuditLogFilterValues } from "@/app/(app)/audit/audit-log-filters";
import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { StatusBadge } from "@/components/data/status-badge";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { authorizePermission } from "@/domain/authz/authorize";
import { parseAuditViewerSearchParams } from "@/domain/audit/schema";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import {
  loadAuditEventsForUi,
  loadAuditViewerOptions,
  type AuditLogRow,
} from "@/server/audit/actions";

export const dynamic = "force-dynamic";

function toDateInputValue(value: Date | undefined): string {
  if (!value) {
    return "";
  }
  return value.toISOString().slice(0, 10);
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "audit.read").allowed) {
    redirect("/");
  }

  const params = await searchParams;
  const query = parseAuditViewerSearchParams(params);
  const options = await loadAuditViewerOptions(query.companyId);
  if (!options.ok) {
    redirect("/");
  }

  const result = await loadAuditEventsForUi(query, options.timeZone);

  const filters: AuditLogFilterValues = {
    companyId: query.companyId ?? "",
    actorUserId: query.actorUserId ?? "",
    actorType: query.actorType ?? "",
    entityType: query.entityType ?? "",
    entityId: query.entityId ?? "",
    action: query.action ?? "",
    dateFrom: toDateInputValue(query.dateFrom),
    dateTo: toDateInputValue(query.dateTo),
  };

  const columns: DataTableColumn<AuditLogRow>[] = [
    {
      id: "when",
      header: "When",
      className: "whitespace-nowrap font-mono text-xs",
      cell: (row) => row.occurredAtDisplay,
    },
    {
      id: "actor",
      header: "Actor",
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge status={row.actorType} />
          <span className="text-muted-foreground font-mono text-xs">{row.actorLabel}</span>
        </span>
      ),
    },
    {
      id: "company",
      header: "Company",
      cell: (row) => row.companyDisplayName,
    },
    {
      id: "action",
      header: "Action",
      className: "font-mono text-xs",
      cell: (row) => row.action,
    },
    {
      id: "entity",
      header: "Entity",
      cell: (row) =>
        row.entityHref ? (
          <Link
            href={row.entityHref}
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            {row.entityType}
            {row.entityId ? ` · ${row.entityId.slice(0, 8)}` : ""}
          </Link>
        ) : (
          <span>
            {row.entityType}
            {row.entityId ? ` · ${row.entityId.slice(0, 8)}` : ""}
          </span>
        ),
    },
    {
      id: "reason",
      header: "Reason",
      cell: (row) => row.reason ?? "—",
    },
    {
      id: "details",
      header: "Details",
      cell: (row) => <AuditEventDetailButton event={row} />,
    },
  ];

  return (
    <PageFrame width="wide">
      <PageHeader
        title="Audit logs"
        description="Read-only history of privileged actions. Admin sees all companies; Compliance is limited to assigned companies. Staff cannot view audit logs."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Audit logs" }]}
      />

      <AuditLogFilters companies={options.companies} initial={filters} />

      {!result.ok ? (
        <Alert variant={result.status === 403 ? "destructive" : "default"}>
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : (
        <DataTable
          columns={columns}
          rows={result.data}
          rowKey={(row) => row.id}
          summary={`${result.data.length} event(s) · times in ${options.timeZone}`}
          emptyTitle="No audit events"
          emptyDescription="No audit events match these filters for companies you can access."
        />
      )}
    </PageFrame>
  );
}
