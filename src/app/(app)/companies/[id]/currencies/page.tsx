import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { CompanyCurrencyForm } from "@/app/(app)/companies/[id]/currencies/company-currency-form";
import { loadCompanyCurrenciesForAdmin } from "@/server/companies/company-currency-actions";

export const dynamic = "force-dynamic";

export default async function CompanyCurrenciesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await loadCompanyCurrenciesForAdmin(id);

  if (!result.ok) {
    if (result.status === 403) {
      redirect("/");
    }
    if (result.status === 404) {
      redirect("/companies");
    }
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p className="text-destructive text-sm">{result.error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-8">
      <Card>
        <CardHeader className="grid gap-2">
          <h1 className="text-lg font-semibold">Company currencies</h1>
          <CardDescription>
            Enabled invoice currencies and default for {result.data.companyDisplayName}. Globally
            disabled currencies cannot be newly enabled (BR-002). Disabled currencies remain visible
            for historical records but are hidden from new-document pickers (BR-011).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CompanyCurrencyForm configuration={result.data} />
        </CardContent>
      </Card>
    </main>
  );
}
