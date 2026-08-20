import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { countryName } from "@/domain/companies/countries";
import { loadCompanyForAdmin } from "@/server/companies/actions";
import { CompanyStatusControls } from "@/app/(app)/companies/[id]/company-status-controls";

export const dynamic = "force-dynamic";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid gap-1">
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</dt>
      <dd className="text-sm">{value && value.length > 0 ? value : "—"}</dd>
    </div>
  );
}

export default async function CompanyViewPage({ params }: { params: Promise<{ id: string }> }) {
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
  const country = company.countryCode
    ? `${countryName(company.countryCode) ?? company.countryCode} (${company.countryCode})`
    : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-8">
      <Card>
        <CardHeader className="grid gap-2">
          <h1 className="text-lg font-semibold">{company.displayName}</h1>
          <CardDescription>
            Company identity and address. Status is Active or Inactive.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Display name" value={company.displayName} />
            <Field label="Legal name" value={company.legalName} />
            <Field label="Status" value={company.status} />
            <Field label="Country" value={country} />
            <Field label="Email" value={company.email} />
            <Field label="Phone" value={company.phone} />
            <Field label="Website" value={company.website} />
            <Field label="Registration / tax number" value={company.registrationTaxNumber} />
            <Field label="Address line 1" value={company.addressLine1} />
            <Field label="Address line 2" value={company.addressLine2} />
            <Field label="City" value={company.city} />
            <Field label="Region / state" value={company.region} />
            <Field label="Postal code" value={company.postalCode} />
          </dl>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={`/companies/${company.id}/edit`}>Edit</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/companies/${company.id}/branding`}>Invoice Branding</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/companies/${company.id}/currencies`}>Currencies</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/companies/${company.id}/settlement`}>Settlement</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/companies">Back to list</Link>
            </Button>
          </div>
          <CompanyStatusControls companyId={company.id} status={company.status} />
        </CardContent>
      </Card>
    </main>
  );
}
