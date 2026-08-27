import Link from "next/link";
import { redirect } from "next/navigation";

import {
  ComplianceReportFilters,
  type ComplianceReportFilterValues,
} from "@/app/(app)/reports/compliance/compliance-report-filters";
import { ReportExportActions } from "@/app/(app)/reports/report-export-actions";
import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authorizePermission } from "@/domain/authz/authorize";
import type { ComplianceReviewSubjectType, ComplianceStatus } from "@/domain/compliance/types";
import { parseComplianceReportSearchParams } from "@/domain/reporting/schema";
import type {
  ComplianceReportAgingBucket,
  ComplianceReportNoteReference,
  ComplianceReportSubjectTypeCounts,
} from "@/domain/reporting/types";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { loadComplianceReportForUi, loadComplianceReportOptions } from "@/server/reporting/actions";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<ComplianceStatus, string> = {
  NOT_REVIEWED: "Not reviewed",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  FLAGGED: "Flagged",
};

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

function subjectHref(subjectType: ComplianceReviewSubjectType, subjectId: string): string {
  const segment =
    subjectType === "INVOICE" ? "invoice" : subjectType === "PAYMENT" ? "payment" : "customer";
  return `/compliance/${segment}/${subjectId}`;
}

function formatNoteKinds(row: ComplianceReportNoteReference): string {
  const parts: string[] = [];
  if (row.hasNotes) {
    parts.push("notes");
  }
  if (row.hasReason) {
    parts.push("reason");
  }
  if (row.hasResolutionNotes) {
    parts.push("resolution");
  }
  if (row.evidenceRefCount > 0) {
    parts.push(`evidence×${row.evidenceRefCount}`);
  }
  return parts.length > 0 ? parts.join(", ") : "—";
}

export default async function ComplianceReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getRequestAuthorizationPrincipal();
  if (
    !authorizePermission(actor, "report.view").allowed ||
    !authorizePermission(actor, "compliance.review").allowed
  ) {
    redirect("/");
  }
  const canExport =
    authorizePermission(actor, "report.export").allowed &&
    authorizePermission(actor, "compliance.review").allowed;

  const params = await searchParams;
  const query = parseComplianceReportSearchParams(params);
  const options = await loadComplianceReportOptions(query.companyId);
  if (!options.ok) {
    redirect("/");
  }

  const companyId = query.companyId ?? options.data.defaultCompanyId ?? undefined;
  const listQuery = {
    ...query,
    ...(companyId ? { companyId } : {}),
  };

  const result = await loadComplianceReportForUi(listQuery);

  const filterValues: ComplianceReportFilterValues = {
    companyId: companyId ?? "",
    staffUserId: query.staffUserId ?? "",
    reportingGroupId: query.reportingGroupId ?? "",
    dateFrom: toDateInputValue(query.dateFrom),
    dateTo: toDateInputValue(query.dateTo),
    gateway: query.gateway ?? "",
    currency: query.currency ?? "",
    status: query.status ?? "",
    subjectType: query.subjectType ?? "",
  };

  const subjectColumns: DataTableColumn<ComplianceReportSubjectTypeCounts>[] = [
    {
      id: "subjectType",
      header: "Subject",
      cell: (row) => SUBJECT_LABELS[row.subjectType],
    },
    {
      id: "pending",
      header: "Pending",
      className: "font-mono tabular-nums",
      cell: (row) => String(row.pending),
    },
    {
      id: "approved",
      header: "Approved",
      className: "font-mono tabular-nums",
      cell: (row) => String(row.approved),
    },
    {
      id: "flagged",
      header: "Flagged",
      className: "font-mono tabular-nums",
      cell: (row) => String(row.flagged),
    },
    {
      id: "total",
      header: "Total",
      className: "font-mono tabular-nums",
      cell: (row) => String(row.total),
    },
  ];

  const agingColumns: DataTableColumn<ComplianceReportAgingBucket>[] = [
    {
      id: "bucket",
      header: "Age",
      cell: (row) => row.label,
    },
    {
      id: "pending",
      header: "Pending",
      className: "font-mono tabular-nums",
      cell: (row) => String(row.pendingCount),
    },
    {
      id: "flagged",
      header: "Flagged",
      className: "font-mono tabular-nums",
      cell: (row) => String(row.flaggedCount),
    },
    {
      id: "total",
      header: "Total",
      className: "font-mono tabular-nums",
      cell: (row) => String(row.totalCount),
    },
  ];

  const noteColumns: DataTableColumn<ComplianceReportNoteReference>[] = [
    {
      id: "createdAt",
      header: "When",
      cell: (row) => (
        <span className="font-mono text-sm tabular-nums">{row.createdAt.slice(0, 10)}</span>
      ),
    },
    {
      id: "subject",
      header: "Subject",
      cell: (row) => (
        <Link
          href={subjectHref(row.subjectType, row.subjectId)}
          className="text-primary underline-offset-4 hover:underline"
        >
          {SUBJECT_LABELS[row.subjectType]}
          {row.label ? ` · ${row.label}` : ""}
        </Link>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => STATUS_LABELS[row.status],
    },
    {
      id: "refs",
      header: "Notes references",
      cell: (row) => formatNoteKinds(row),
    },
  ];

  return (
    <PageFrame width="wide">
      <PageHeader
        title="Compliance report"
        description="Review counts, approved / flagged / pending, aging of open items, and notes references. Admin and Compliance only — Staff denied by default. Read-only; does not change audit logs."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Reports" }, { label: "Compliance" }]}
      />

      <ComplianceReportFilters
        initial={filterValues}
        companies={options.data.companies}
        reportingGroups={options.data.reportingGroups}
        allowsAllCompanies={options.data.allowsAllCompanies}
      />

      {canExport ? (
        <ReportExportActions reportType="compliance-report" filters={filterValues} />
      ) : null}

      {!result.ok ? (
        <Alert variant={result.status === 403 ? "destructive" : "default"}>
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-8" data-testid="compliance-report">
          <section className="grid gap-3" data-testid="compliance-report-status-counts">
            <h2 className="text-foreground text-base font-medium">Review counts</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Pending</CardDescription>
                  <CardTitle className="font-mono text-2xl tabular-nums">
                    {result.data.statusCounts.pending}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground text-xs">
                  Not reviewed {result.data.statusCounts.notReviewed} · Under review{" "}
                  {result.data.statusCounts.underReview}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Approved</CardDescription>
                  <CardTitle className="font-mono text-2xl tabular-nums">
                    {result.data.statusCounts.approved}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Flagged</CardDescription>
                  <CardTitle className="font-mono text-2xl tabular-nums">
                    {result.data.statusCounts.flagged}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total subjects</CardDescription>
                  <CardTitle className="font-mono text-2xl tabular-nums">
                    {result.data.statusCounts.total}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>
          </section>

          <section className="grid gap-3" data-testid="compliance-report-by-subject">
            <h2 className="text-foreground text-base font-medium">Counts by subject type</h2>
            <DataTable
              columns={subjectColumns}
              rows={result.data.bySubjectType}
              rowKey={(row) => row.subjectType}
              emptyTitle="No subjects"
              emptyDescription="No invoice, payment, or customer subjects match these filters."
            />
          </section>

          <section className="grid gap-3" data-testid="compliance-report-aging">
            <h2 className="text-foreground text-base font-medium">Aging (pending and flagged)</h2>
            <DataTable
              columns={agingColumns}
              rows={result.data.aging}
              rowKey={(row) => row.bucket}
              emptyTitle="No aging rows"
              emptyDescription="No pending or flagged subjects with dates match these filters."
            />
          </section>

          <section className="grid gap-3" data-testid="compliance-report-notes">
            <h2 className="text-foreground text-base font-medium">Notes references</h2>
            <DataTable
              columns={noteColumns}
              rows={result.data.noteReferences}
              rowKey={(row) => row.reviewId}
              summary={
                result.data.noteReferenceTotal === 0
                  ? undefined
                  : `Showing ${result.data.noteReferences.length} of ${result.data.noteReferenceTotal} note-bearing review(s)`
              }
              emptyTitle="No notes references"
              emptyDescription="No compliance reviews with notes, reason codes, resolution notes, or evidence refs match these filters."
            />
          </section>
        </div>
      )}
    </PageFrame>
  );
}
