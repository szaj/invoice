import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { loadCurrenciesForAdmin } from "@/server/currencies/actions";

export const dynamic = "force-dynamic";

export default async function CurrenciesPage() {
  const result = await loadCurrenciesForAdmin();
  if (!result.ok) {
    if (result.status === 403) {
      redirect("/");
    }
    return (
      <main className="mx-auto max-w-4xl p-8">
        <p className="text-destructive text-sm">{result.error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-xl font-semibold">Currencies</h1>
          <p className="text-muted-foreground text-sm">
            Global currency catalog. Company enablement is configured per company. Admin-defined
            fixed conversion rates use Settings → Create fixed rate. Disabled currencies remain for
            historical display.
          </p>
        </div>
        <Button asChild>
          <Link href="/settings/currencies/new">Add currency</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardDescription>{result.data.length} currency(ies)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 pr-4 font-medium">Code</th>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Symbol</th>
                  <th className="py-2 pr-4 font-medium">Decimals</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((currency) => (
                  <tr key={currency.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      <Link
                        href={`/settings/currencies/${currency.id}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {currency.code}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{currency.name}</td>
                    <td className="py-2 pr-4">{currency.symbol}</td>
                    <td className="py-2 pr-4">{currency.decimalPrecision}</td>
                    <td className="py-2">{currency.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-sm">
        <Link href="/" className="text-primary underline-offset-4 hover:underline">
          Back to home
        </Link>
      </p>
    </main>
  );
}
