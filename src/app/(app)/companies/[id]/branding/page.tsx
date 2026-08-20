import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { CompanyBrandingForm } from "@/app/(app)/companies/[id]/branding/branding-form";
import { loadCompanyBrandingForAdmin } from "@/server/companies/branding-actions";

export const dynamic = "force-dynamic";

export default async function CompanyBrandingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadCompanyBrandingForAdmin(id);

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
          <h1 className="text-lg font-semibold">Invoice Branding</h1>
          <CardDescription>
            Brand identity for {result.data.displayName}. Logo, invoice prefix, terms, email
            template reference, and brand contact details. PDF rendering and email sending are not
            enabled here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CompanyBrandingForm branding={result.data} />
        </CardContent>
      </Card>
    </main>
  );
}
