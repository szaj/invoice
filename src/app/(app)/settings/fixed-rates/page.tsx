import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { loadFixedConversionRatesForAdmin } from "@/server/fixed-rates/actions";

export const dynamic = "force-dynamic";

export default async function FixedRatesHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; fromCurrency?: string; toCurrency?: string }>;
}) {
  const params = await searchParams;
  const fromCurrency = params.fromCurrency?.toUpperCase();
  const toCurrency = params.toCurrency?.toUpperCase();
  const result = await loadFixedConversionRatesForAdmin({ fromCurrency, toCurrency });

  if (!result.ok) {
    if (result.status === 403) {
      redirect("/");
    }
    return (
      <main className="mx-auto max-w-5xl p-8">
        <p className="text-destructive text-sm">{result.error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-xl font-semibold">Fixed conversion rate versions</h1>
          <p className="text-muted-foreground text-sm">
            Append-only history. Creating a new version expires prior ACTIVE versions for the same
            pair but retains them permanently (BR-021 / BR-022). Historical rate amounts are never
            edited in place.
          </p>
        </div>
        <Button asChild>
          <Link href="/settings/fixed-rates/new">Create new version</Link>
        </Button>
      </div>

      {params.created ? (
        <p className="text-sm text-green-700" role="status">
          Version created ({params.created}). Prior ACTIVE versions for that pair were expired if
          present.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardDescription>
            {result.data.length} version(s)
            {fromCurrency && toCurrency ? ` for ${fromCurrency} → ${toCurrency}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 pr-3 font-medium">Pair</th>
                  <th className="py-2 pr-3 font-medium">Version</th>
                  <th className="py-2 pr-3 font-medium">Rate</th>
                  <th className="py-2 pr-3 font-medium">Frequency</th>
                  <th className="py-2 pr-3 font-medium">Valid from</th>
                  <th className="py-2 pr-3 font-medium">Valid to</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {result.data.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-muted-foreground py-4">
                      No fixed rates yet. Create the first version to begin.
                    </td>
                  </tr>
                ) : (
                  result.data.map((rate) => (
                    <tr key={rate.id} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        <Link
                          href={`/settings/fixed-rates?fromCurrency=${rate.fromCurrency}&toCurrency=${rate.toCurrency}`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {rate.fromCurrency} → {rate.toCurrency}
                        </Link>
                      </td>
                      <td className="py-2 pr-3">{rate.versionNo}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{rate.fixedRate}</td>
                      <td className="py-2 pr-3">{rate.frequencyLabel}</td>
                      <td className="py-2 pr-3">{rate.validFrom.toISOString()}</td>
                      <td className="py-2 pr-3">{rate.validTo?.toISOString() ?? "—"}</td>
                      <td className="py-2">{rate.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-sm">
        <Link href="/" className="text-primary underline-offset-4 hover:underline">
          Back to home
        </Link>
        {fromCurrency || toCurrency ? (
          <>
            {" · "}
            <Link
              href="/settings/fixed-rates"
              className="text-primary underline-offset-4 hover:underline"
            >
              Clear pair filter
            </Link>
          </>
        ) : null}
      </p>
    </main>
  );
}
