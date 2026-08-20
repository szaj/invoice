import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { loadCompaniesForAdmin } from "@/server/companies/actions";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const result = await loadCompaniesForAdmin();
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
          <h1 className="text-xl font-semibold">Companies</h1>
          <p className="text-muted-foreground text-sm">
            Admin company records and invoice branding. Gateway credentials, currencies, invoice
            sequence issuance, and reporting groups are not available yet.
          </p>
        </div>
        <Button asChild>
          <Link href="/companies/new">Create company</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardDescription>{result.data.length} company(ies)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 pr-4 font-medium">Display name</th>
                  <th className="py-2 pr-4 font-medium">Legal name</th>
                  <th className="py-2 pr-4 font-medium">Country</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((company) => (
                  <tr key={company.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      <Link
                        href={`/companies/${company.id}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {company.displayName}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{company.legalName ?? "—"}</td>
                    <td className="py-2 pr-4">{company.countryCode ?? "—"}</td>
                    <td className="py-2">{company.status}</td>
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
