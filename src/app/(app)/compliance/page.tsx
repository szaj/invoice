import Link from "next/link";
import { redirect } from "next/navigation";

import { ComplianceExportButton } from "@/app/(app)/compliance/compliance-export-button";
import {
  ComplianceQueueFilters,
  type ComplianceQueueFilterValues,
} from "@/app/(app)/compliance/compliance-queue-filters";
import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { StatusBadge } from "@/components/data/status-badge";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { authorizePermission } from "@/domain/authz/authorize";
import { parseComplianceQueueSearchParams } from "@/domain/compliance/schema";
import type { ComplianceReviewSubjectType } from "@/domain/compliance/types";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import {
  loadComplianceQueueForUi,
  loadComplianceQueueOptions,
  type ComplianceQueueRow,
} from "@/server/compliance/actions";

export const dynamic = "force-dynamic";

const SUBJECT_LABELS: Record<ComplianceReviewSubjectType, string> = {
  INVOICE: "Invoice",
  PAYMENT: "Payment",
  CUSTOMER: "Customer",
};

function toDateInputValue(value: Date | undefined): string {
  if (!value) {
    return "";
  }
  return value.toISOString().slice(0, 10);
}

export default async function ComplianceQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "compliance.review").allowed) {
    redirect("/");
  }
  const canExport = authorizePermission(actor, "report.export").allowed;

  const params = await searchParams;
  const query = parseComplianceQueueSearchParams(params);
  const options = await loadComplianceQueueOptions(query.companyId);
  if (!options.ok) {
    redirect("/");
  }

  const companyId = query.companyId ?? options.defaultCompanyId ?? undefined;
  const listQuery = {
    ...query,
    ...(companyId ? { companyId } : {}),
  };

  const result = await loadComplianceQueueForUi(listQuery);
  const exportFilters: ComplianceQueueFilterValues = {
    companyId: companyId ?? "",
    staffUserId: query.staffUserId ?? "",
    dateFrom: toDateInputValue(query.dateFrom),
    dateTo: toDateInputValue(query.dateTo),
    amountMin: query.amountMin ?? "",
    amountMax: query.amountMax ?? "",
    gateway: query.gateway ?? "",
    currency: query.currency ?? "",
    status: query.status ?? "",
    subjectType: query.subjectType ?? "",
  };

  const columns: DataTableColumn<ComplianceQueueRow>[] = [
    {
      id: "subject",
      header: "Subject",
      cell: (row) => (
        <Link
          href={row.href}
          className="text-foreground font-medium underline-offset-4 hover:underline"
        >
          {SUBJECT_LABELS[row.subjectType]}
          {row.label ? ` · ${row.label}` : ` · ${row.subjectId.slice(0, 8)}`}
        </Link>
      ),
    },
    {
      id: "company",
      header: "Company",
      cell: (row) => row.companyDisplayName,
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={row.complianceStatus} />,
    },
    {
      id: "date",
      header: "Date",
      cell: (row) => row.date ?? "—",
    },
    {
      id: "amount",
      header: "Amount",
      className: "font-mono tabular-nums",
      cell: (row) =>
        row.amount && row.currencyCode ? `${row.amount} ${row.currencyCode}` : (row.amount ?? "—"),
    },
    {
      id: "gateway",
      header: "Gateway",
      cell: (row) => row.gateway ?? "—",
    },
    {
      id: "staff",
      header: "Staff",
      cell: (row) =>
        row.staffUserId ? (
          <span className="font-mono text-xs">{row.staffUserId.slice(0, 8)}</span>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <PageFrame width="wide">
      <PageHeader
        title="Compliance review"
        description="Queue of invoices, payments, and customers for review. Approve, flag, and add notes from each record. Staff has no review actions."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Compliance" }]}
        actions={canExport ? <ComplianceExportButton filters={exportFilters} /> : null}
      />

      <ComplianceQueueFilters companies={options.companies} initial={exportFilters} />

      {!result.ok ? (
        <Alert variant={result.status === 403 ? "destructive" : "default"}>
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : (
        <DataTable
          columns={columns}
          rows={result.data}
          rowKey={(row) => `${row.subjectType}:${row.subjectId}:${row.companyId}`}
          summary={`${result.data.length} record(s) in review queue`}
          emptyTitle="No compliance records"
          emptyDescription="No invoices, payments, or customers match these filters for your assigned companies."
        />
      )}
    </PageFrame>
  );
}
