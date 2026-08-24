import { redirect } from "next/navigation";
import Link from "next/link";

import { GatewayConfigForm } from "@/app/(app)/companies/[id]/gateways/gateway-config-form";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { loadCompanyGatewaysForAdmin } from "@/server/gateway-config/actions";

export const dynamic = "force-dynamic";

export default async function CompanyGatewaysPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadCompanyGatewaysForAdmin(id);

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
          <h1 className="text-lg font-semibold">Gateway settings</h1>
          <CardDescription>
            Per payment-method gateway configuration for {result.data.companyDisplayName}.
            Credentials are encrypted at rest and never shown after save. Settlement currencies are
            managed separately.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div>
            <Button asChild variant="outline" size="sm">
              <Link href={`/companies/${id}/settlement`}>Settlement currencies</Link>
            </Button>
          </div>
          <GatewayConfigForm configuration={result.data} />
        </CardContent>
      </Card>
    </main>
  );
}
