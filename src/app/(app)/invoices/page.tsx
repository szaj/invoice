import Link from "next/link";
import { redirect } from "next/navigation";

import { InvoiceListFilters } from "@/app/(app)/invoices/invoice-list-filters";
import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { StatusBadge } from "@/components/data/status-badge";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { authorizePermission } from "@/domain/authz/authorize";
import { parseInvoiceDraftListSearchParams, toDateInputValue } from "@/domain/invoices/schema";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { loadCompanyContextForLayout } from "@/server/company-context/actions";
import { loadDraftInvoicesForUi, loadInvoiceFormOptions } from "@/server/invoices/actions";

export const dynamic = "force-dynamic";

type InvoiceRow = {
  id: string;
  invoiceNumber: string | null;
  companyId: string;
  invoiceDate: Date;
  dueDate: Date;
  currencyCode: string;
  status: string;
};

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getRequestAuthorizationPrincipal();
  const canCreate = authorizePermission(actor, "invoice.create").allowed;
  if (!canCreate) {
    redirect("/");
  }

  const params = await searchParams;
  const query = parseInvoiceDraftListSearchParams(params);
  const status = query.status ?? "DRAFT";
  const options = await loadInvoiceFormOptions(query.companyId);
  if (!options.ok) {
    redirect("/");
  }

  const context = await loadCompanyContextForLayout();
  const contextCompanyId =
    context.selection?.kind === "company" ? context.selection.companyId : null;
  const companyId =
    query.companyId ??
    (contextCompanyId && options.companies.some((company) => company.id === contextCompanyId)
      ? contextCompanyId
      : options.companies.length === 1
        ? options.companies[0]?.id
        : undefined);

  const result = await loadDraftInvoicesForUi(companyId ? { companyId, status } : { status });

  if (!result.ok) {
    if (result.status === 403) {
      redirect("/");
    }
    return (
      <PageFrame width="wide">
        <PageHeader title="Invoices" />
        <Alert variant="destructive">
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
        <InvoiceListFilters
          initialCompanyId={companyId ?? ""}
          initialStatus={status}
          companies={options.companies}
        />
      </PageFrame>
    );
  }

  const companyNameById = new Map(
    options.companies.map((company) => [company.id, company.displayName]),
  );

  const columns: DataTableColumn<InvoiceRow>[] = [
    {
      id: "number",
      header: "Number",
      cell: (invoice) => (
        <Link
          href={`/invoices/${invoice.id}`}
          className="text-foreground font-medium underline-offset-4 hover:underline"
        >
          {invoice.invoiceNumber ?? `Draft ${invoice.id.slice(0, 8)}`}
        </Link>
      ),
    },
    {
      id: "company",
      header: "Company",
      cell: (invoice) => companyNameById.get(invoice.companyId) ?? invoice.companyId.slice(0, 8),
    },
    {
      id: "invoiceDate",
      header: "Invoice date",
      cell: (invoice) => toDateInputValue(invoice.invoiceDate),
    },
    {
      id: "dueDate",
      header: "Due date",
      cell: (invoice) => toDateInputValue(invoice.dueDate),
    },
    {
      id: "currency",
      header: "Currency",
      className: "font-mono tabular-nums",
      cell: (invoice) => invoice.currencyCode,
    },
    {
      id: "status",
      header: "Status",
      cell: (invoice) => <StatusBadge status={invoice.status} />,
    },
  ];

  return (
    <PageFrame width="wide">
      <PageHeader
        title="Invoices"
        description="Filter by status. Issue drafts from the invoice detail page."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Invoices" }]}
        actions={
          canCreate ? (
            <Button asChild>
              <Link href="/invoices/new">Create draft</Link>
            </Button>
          ) : null
        }
      />

      <InvoiceListFilters
        initialCompanyId={companyId ?? ""}
        initialStatus={status}
        companies={options.companies}
      />

      <DataTable
        columns={columns}
        rows={result.data}
        rowKey={(invoice) => invoice.id}
        summary={`${result.data.length} invoice(s) with status ${status}${
          companyId ? ` for ${companyNameById.get(companyId) ?? "selected company"}` : ""
        }`}
        emptyTitle="No invoices found"
        emptyDescription="No invoices match this company scope and status."
        emptyAction={
          canCreate ? (
            <Button asChild size="sm">
              <Link href="/invoices/new">Create draft</Link>
            </Button>
          ) : undefined
        }
      />
    </PageFrame>
  );
}
