import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { SettlementConfigForm } from "@/app/(app)/companies/[id]/settlement/settlement-config-form";
import { loadCompanySettlementForAdmin } from "@/server/settlement/actions";

export const dynamic = "force-dynamic";

export default async function CompanySettlementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await loadCompanySettlementForAdmin(id);

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
          <h1 className="text-lg font-semibold">Settlement currencies</h1>
          <CardDescription>
            Per payment-method settlement currency enablement for {result.data.companyDisplayName}.
            Initial Version 1 currencies are USD and AED; Admin may enable other globally ACTIVE
            catalog codes (BR-006 / BR-007). Credentials and live charges are not configured here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettlementConfigForm configuration={result.data} />
        </CardContent>
      </Card>
    </main>
  );
}
