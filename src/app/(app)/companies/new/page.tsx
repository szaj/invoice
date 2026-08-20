import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { CompanyForm } from "@/app/(app)/companies/company-form";
import { authorizePermission } from "@/domain/authz/authorize";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";

export const dynamic = "force-dynamic";

export default async function NewCompanyPage() {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "company.write").allowed) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-8">
      <Card>
        <CardHeader className="grid gap-2">
          <h1 className="text-lg font-semibold">Create company</h1>
          <CardDescription>
            Identity, address, and status only. Currencies, gateways, and branding files are later
            tasks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CompanyForm
            submitLabel="Create company"
            defaultValues={{
              displayName: "",
              legalName: "",
              email: "",
              phone: "",
              website: "",
              registrationTaxNumber: "",
              addressLine1: "",
              addressLine2: "",
              city: "",
              region: "",
              postalCode: "",
              countryCode: "",
              status: "ACTIVE",
            }}
          />
        </CardContent>
      </Card>
    </main>
  );
}
