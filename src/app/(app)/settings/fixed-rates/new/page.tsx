import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { FixedRateCreateForm } from "@/app/(app)/settings/fixed-rates/new/fixed-rate-create-form";
import { loadCurrenciesForFixedRateForm } from "@/server/fixed-rates/actions";

export const dynamic = "force-dynamic";

export default async function NewFixedRatePage() {
  const result = await loadCurrenciesForFixedRateForm();
  if (!result.ok) {
    if (result.status === 403) {
      redirect("/");
    }
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p className="text-destructive text-sm">{result.error}</p>
      </main>
    );
  }

  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const defaultValidFrom = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}T${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-8">
      <Card>
        <CardHeader className="grid gap-2">
          <h1 className="text-lg font-semibold">Create fixed conversion rate version</h1>
          <CardDescription>
            Versioned Admin fixed rates only (BR-021 / BR-022). Creating a new version expires prior
            ACTIVE versions for the pair but retains them. Historical rate amounts are never edited
            in place.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FixedRateCreateForm
            currencies={result.data.map((currency) => ({
              code: currency.code,
              name: currency.name,
              status: currency.status,
            }))}
            defaultValues={{
              fromCurrency: "",
              toCurrency: "",
              fixedRate: "",
              frequencyLabel: "MANUAL",
              validFrom: defaultValidFrom,
              validTo: "",
              notes: "",
            }}
          />
        </CardContent>
      </Card>
      <p className="text-sm">
        <Link
          href="/settings/fixed-rates"
          className="text-primary underline-offset-4 hover:underline"
        >
          Back to version history
        </Link>
      </p>
    </main>
  );
}
