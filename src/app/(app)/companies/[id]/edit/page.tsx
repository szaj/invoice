import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { CompanyForm } from "@/app/(app)/companies/company-form";
import { loadCompanyForAdmin } from "@/server/companies/actions";

export const dynamic = "force-dynamic";

export default async function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadCompanyForAdmin(id);

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

  const company = result.data;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-8">
      <Card>
        <CardHeader className="grid gap-2">
          <h1 className="text-lg font-semibold">Edit company</h1>
          <CardDescription>
            Invalid updates are rejected. Logo, currencies, invoice numbering, and gateway
            credentials are not editable here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CompanyForm
            companyId={company.id}
            submitLabel="Save changes"
            defaultValues={{
              displayName: company.displayName,
              legalName: company.legalName ?? "",
              email: company.email ?? "",
              phone: company.phone ?? "",
              website: company.website ?? "",
              registrationTaxNumber: company.registrationTaxNumber ?? "",
              addressLine1: company.addressLine1 ?? "",
              addressLine2: company.addressLine2 ?? "",
              city: company.city ?? "",
              region: company.region ?? "",
              postalCode: company.postalCode ?? "",
              countryCode: company.countryCode ?? "",
              status: company.status,
            }}
          />
        </CardContent>
      </Card>
    </main>
  );
}
