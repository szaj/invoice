import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyStatusControls } from "@/app/(app)/settings/currencies/[id]/status-controls";
import { loadCurrencyForAdmin } from "@/server/currencies/actions";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function CurrencyDetailPage({ params }: PageProps) {
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
      <div className="flex items-center justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-xl font-semibold">
            {currency.code} — {currency.name}
          </h1>
          <p className="text-muted-foreground text-sm">
            Global catalog record. Disabling keeps the currency for historical display.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/settings/currencies/${currency.id}/edit`}>Edit</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
          <CardDescription>Status: {currency.status}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <p>
            <span className="text-muted-foreground">Symbol:</span> {currency.symbol}
          </p>
          <p>
            <span className="text-muted-foreground">Decimal precision:</span>{" "}
            {currency.decimalPrecision}
          </p>
          <CurrencyStatusControls currencyId={currency.id} status={currency.status} />
        </CardContent>
      </Card>

      <p className="text-sm">
        <Link
          href="/settings/currencies"
          className="text-primary underline-offset-4 hover:underline"
        >
          Back to currencies
        </Link>
      </p>
    </main>
  );
}
