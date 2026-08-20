import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { authorizePermission } from "@/domain/authz/authorize";
import { ReportingGroupForm } from "@/app/(app)/settings/reporting-groups/reporting-group-form";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { loadCompaniesForReportingGroupForm } from "@/server/reporting-groups/actions";

export const dynamic = "force-dynamic";

export default async function NewReportingGroupPage() {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "company.write").allowed) {
    redirect("/");
  }

  const companies = await loadCompaniesForReportingGroupForm();
  if (!companies.ok) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-8">
      <Card>
        <CardHeader className="grid gap-2">
          <h1 className="text-lg font-semibold">Create reporting group</h1>
          <CardDescription>
            Create an optional parent group and assign brands for later consolidated reports.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReportingGroupForm
            submitLabel="Create group"
            companies={companies.data.map((company) => ({
              id: company.id,
              displayName: company.displayName,
              status: company.status,
            }))}
            defaultValues={{
              name: "",
              code: "",
              status: "ACTIVE",
              displayOrder: 0,
              companyIds: [],
            }}
          />
        </CardContent>
      </Card>
    </main>
  );
}
