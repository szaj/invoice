import Link from "next/link";
import { redirect } from "next/navigation";

import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { StatusBadge } from "@/components/data/status-badge";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { loadCurrenciesForAdmin } from "@/server/currencies/actions";

export const dynamic = "force-dynamic";

type CurrencyRow = {
  id: string;
  code: string;
  name: string;
  symbol: string;
  decimalPrecision: number;
  status: string;
};

export default async function CurrenciesPage() {
  const result = await loadCurrenciesForAdmin();
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

  const columns: DataTableColumn<CurrencyRow>[] = [
    {
      id: "code",
      header: "Code",
      className: "font-mono font-medium",
      cell: (currency) => (
        <Link
          href={`/settings/currencies/${currency.id}`}
          className="underline-offset-4 hover:underline"
        >
          {currency.code}
        </Link>
      ),
    },
    {
      id: "name",
      header: "Name",
      cell: (currency) => currency.name,
    },
    {
      id: "symbol",
      header: "Symbol",
      cell: (currency) => currency.symbol,
    },
    {
      id: "decimals",
      header: "Decimals",
      className: "font-mono tabular-nums",
      cell: (currency) => currency.decimalPrecision,
    },
    {
      id: "status",
      header: "Status",
      cell: (currency) => <StatusBadge status={currency.status} />,
    },
  ];

  return (
    <PageFrame width="wide">
      <PageHeader
        title="Currencies"
        description="Global currency catalog. Company enablement is configured per company. Disabled currencies remain for historical display."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Settings" }, { label: "Currencies" }]}
        actions={
          <Button asChild>
            <Link href="/settings/currencies/new">Add currency</Link>
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={result.data}
        rowKey={(currency) => currency.id}
        summary={`${result.data.length} currency(ies)`}
        emptyTitle="No currencies"
        emptyDescription="Add a currency to the global catalog."
      />
    </PageFrame>
  );
}
