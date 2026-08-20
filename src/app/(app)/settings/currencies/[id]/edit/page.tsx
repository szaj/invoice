import Link from "next/link";
import { redirect } from "next/navigation";

import { CurrencyForm } from "@/app/(app)/settings/currencies/currency-form";
import { loadCurrencyForAdmin } from "@/server/currencies/actions";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditCurrencyPage({ params }: PageProps) {
  const { id } = await params;
  const result = await loadCurrencyForAdmin(id);
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

  const currency = result.data;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">Edit {currency.code}</h1>
        <p className="text-muted-foreground text-sm">
          Update name, symbol, precision, or status. Code cannot change.
        </p>
      </div>
      <CurrencyForm
        currencyId={currency.id}
        codeLocked
        submitLabel="Save currency"
        defaultValues={{
          code: currency.code,
          name: currency.name,
          symbol: currency.symbol,
          decimalPrecision: currency.decimalPrecision,
          status: currency.status,
        }}
      />
      <p className="text-sm">
        <Link
          href={`/settings/currencies/${currency.id}`}
          className="text-primary underline-offset-4 hover:underline"
        >
          Back to currency
        </Link>
      </p>
    </main>
  );
}
