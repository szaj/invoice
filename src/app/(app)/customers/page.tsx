import Link from "next/link";
import { redirect } from "next/navigation";

import { CustomerListFilters } from "@/app/(app)/customers/customer-list-filters";
import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { StatusBadge } from "@/components/data/status-badge";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { authorizePermission } from "@/domain/authz/authorize";
import { parseCustomerListSearchParams } from "@/domain/customers/list-query";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { loadCustomerFormOptions, loadCustomersForUi } from "@/server/customers/actions";

export const dynamic = "force-dynamic";

type CustomerRow = {
  id: string;
  displayName: string;
  customerType: string;
  email: string | null;
  companyIds: readonly string[];
  status: string;
};

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getRequestAuthorizationPrincipal();
  const canEdit = authorizePermission(actor, "customer.edit").allowed;
  const canCreate = authorizePermission(actor, "customer.create").allowed;
  if (!canEdit && !canCreate) {
    redirect("/");
  }

  const params = await searchParams;
  const query = parseCustomerListSearchParams(params);
  const [result, options] = await Promise.all([
    loadCustomersForUi(query),
    loadCustomerFormOptions(),
  ]);

  if (!result.ok) {
    if (result.status === 403) {
      redirect("/");
    }
    return (
      <PageFrame width="wide">
        <Alert variant="destructive">
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      </PageFrame>
    );
  }

  const companies = options.ok ? options.companies : [];
  const initialQ = typeof params.q === "string" ? params.q : "";
  const initialStatus = typeof params.status === "string" ? params.status : "";
  const initialCompanyId = typeof params.companyId === "string" ? params.companyId : "";

  const columns: DataTableColumn<CustomerRow>[] = [
    {
      id: "name",
      header: "Name",
      cell: (customer) => (
        <Link
          href={`/customers/${customer.id}`}
          className="text-foreground font-medium underline-offset-4 hover:underline"
        >
          {customer.displayName}
        </Link>
      ),
    },
    {
      id: "type",
      header: "Type",
      cell: (customer) => customer.customerType,
    },
    {
      id: "email",
      header: "Email",
      cell: (customer) => customer.email ?? "—",
    },
    {
      id: "companies",
      header: "Companies",
      cell: (customer) => (customer.companyIds.length > 0 ? customer.companyIds.length : "—"),
    },
    {
      id: "status",
      header: "Status",
      cell: (customer) => <StatusBadge status={customer.status} />,
    },
  ];

  return (
    <PageFrame width="wide">
      <PageHeader
        title="Customers"
        description="List, search, and maintain customer master records. Filter by authorized company."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Customers" }]}
        actions={
          canCreate ? (
            <Button asChild>
              <Link href="/customers/new">Create customer</Link>
            </Button>
          ) : null
        }
      />

      <CustomerListFilters
        initialQ={initialQ}
        initialStatus={initialStatus}
        initialCompanyId={initialCompanyId}
        companies={companies}
      />

      <DataTable
        columns={columns}
        rows={result.data}
        rowKey={(customer) => customer.id}
        summary={`${result.data.length} customer(s)${
          query.q || query.status || query.companyId ? " matching filters" : ""
        }`}
        emptyTitle="No customers found"
        emptyDescription="Try adjusting filters or create a new customer."
        emptyAction={
          canCreate ? (
            <Button asChild size="sm">
              <Link href="/customers/new">Create customer</Link>
            </Button>
          ) : undefined
        }
      />
    </PageFrame>
  );
}
