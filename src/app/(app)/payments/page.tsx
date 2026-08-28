import Link from "next/link";
import { redirect } from "next/navigation";

import { PaymentListFilters } from "@/app/(app)/payments/payment-list-filters";
import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { ListPagination } from "@/components/data/list-pagination";
import { StatusBadge } from "@/components/data/status-badge";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { authorizePermission } from "@/domain/authz/authorize";
import { parsePaymentListSearchParams } from "@/domain/payments/schema";
import { LIST_DEFAULT_PAGE_SIZE, resolveListPagination } from "@/domain/lists/pagination";
import { PAYMENT_COMPANY_SCOPE_REQUIRED, type PaymentStatus } from "@/domain/payments/types";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { loadCompanyContextForLayout } from "@/server/company-context/actions";
import {
  loadPaymentListOptions,
  loadPaymentsForUi,
  type PaymentListRow,
} from "@/server/payments/actions";

export const dynamic = "force-dynamic";

function buildPaymentListHref(input: {
  readonly companyId?: string;
  readonly status?: PaymentStatus;
  readonly page: number;
  readonly pageSize: number;
}): string {
  const params = new URLSearchParams();
  if (input.companyId) {
    params.set("companyId", input.companyId);
  }
  if (input.status) {
    params.set("status", input.status);
  }
  if (input.page > 1) {
    params.set("page", String(input.page));
  }
  if (input.pageSize !== LIST_DEFAULT_PAGE_SIZE) {
    params.set("pageSize", String(input.pageSize));
  }
  const query = params.toString();
  return query ? `/payments?${query}` : "/payments";
}

function formatDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getRequestAuthorizationPrincipal();
  const canList = authorizePermission(actor, "invoice.create").allowed;
  if (!canList) {
    redirect("/");
  }

  const params = await searchParams;
  const query = parsePaymentListSearchParams(params);
  const options = await loadPaymentListOptions(query.companyId);
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
        : (options.defaultCompanyId ?? undefined));

  const status = query.status;
  const pagination = resolveListPagination({ page: query.page, pageSize: query.pageSize });
  const listQuery = {
    ...(companyId ? { companyId } : {}),
    ...(status ? { status } : {}),
    page: pagination.page,
    pageSize: pagination.pageSize,
    sortBy: query.sortBy,
    sortDir: query.sortDir,
  };

  const result = companyId
    ? await loadPaymentsForUi(listQuery)
    : options.companies.length === 0
      ? {
          ok: true as const,
          data: [] as PaymentListRow[],
          totalCount: 0,
          page: pagination.page,
          pageSize: pagination.pageSize,
        }
      : {
          ok: false as const,
          status: 400,
          error: PAYMENT_COMPANY_SCOPE_REQUIRED,
        };

  const companyNameById = new Map(
    options.companies.map((company) => [company.id, company.displayName]),
  );

  const columns: DataTableColumn<PaymentListRow>[] = [
    {
      id: "date",
      header: "Date",
      cell: (payment) => (
        <Link
          href={`/payments/${payment.id}`}
          className="text-foreground font-medium underline-offset-4 hover:underline"
        >
          {formatDate(payment.paymentDate)}
        </Link>
      ),
    },
    {
      id: "company",
      header: "Company",
      cell: (payment) => payment.companyDisplayName,
    },
    {
      id: "invoice",
      header: "Invoice",
      cell: (payment) => (
        <Link
          href={`/invoices/${payment.invoiceId}`}
          className="text-foreground font-medium underline-offset-4 hover:underline"
        >
          {payment.invoiceLabel}
        </Link>
      ),
    },
    {
      id: "method",
      header: "Method",
      cell: (payment) => payment.methodCode,
    },
    {
      id: "status",
      header: "Status",
      cell: (payment) => <StatusBadge status={payment.status} />,
    },
    {
      id: "applied",
      header: "Applied",
      className: "font-mono tabular-nums",
      cell: (payment) => `${payment.invoiceAmountApplied} ${payment.invoiceCurrencyCode}`,
    },
    {
      id: "settlement",
      header: "Settlement",
      className: "font-mono tabular-nums",
      cell: (payment) => `${payment.convertedSettlementAmount} ${payment.settlementCurrencyCode}`,
    },
    {
      id: "source",
      header: "Source",
      cell: (payment) => payment.source,
    },
  ];

  return (
    <PageFrame width="wide">
      <PageHeader
        title="Payments"
        description="Company-scoped payment transactions. Filter by status. Open a row for settlement snapshot and reconciliation fields."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Payments" }]}
        actions={
          options.canRecordManual ? (
            <Button asChild>
              <Link href="/payments/manual">Record manual payment</Link>
            </Button>
          ) : null
        }
      />

      <PaymentListFilters
        initialCompanyId={companyId ?? ""}
        initialStatus={(status ?? "") as PaymentStatus | ""}
        companies={options.companies}
      />

      {!result.ok ? (
        <Alert variant={result.status === 403 ? "destructive" : "default"}>
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={result.data}
            rowKey={(payment) => payment.id}
            summary={`${result.totalCount} payment(s)${status ? ` with status ${status}` : ""}${
              companyId ? ` for ${companyNameById.get(companyId) ?? "selected company"}` : ""
            } · page ${result.page}`}
            emptyTitle="No payments found"
            emptyDescription="No payments match this company scope and filters."
            emptyAction={
              options.canRecordManual ? (
                <Button asChild size="sm">
                  <Link href="/payments/manual">Record manual payment</Link>
                </Button>
              ) : undefined
            }
          />
          <ListPagination
            page={result.page}
            pageSize={result.pageSize}
            totalCount={result.totalCount}
            hrefForPage={(nextPage) =>
              buildPaymentListHref({
                companyId,
                status,
                page: nextPage,
                pageSize: result.pageSize,
              })
            }
          />
        </>
      )}
    </PageFrame>
  );
}
