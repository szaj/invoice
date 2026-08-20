import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { ReportingGroupForm } from "@/app/(app)/settings/reporting-groups/reporting-group-form";
import {
  loadCompaniesForReportingGroupForm,
  loadReportingGroupForAdmin,
} from "@/server/reporting-groups/actions";

export const dynamic = "force-dynamic";

export default async function EditReportingGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [groupResult, companiesResult] = await Promise.all([
    loadReportingGroupForAdmin(id),
    loadCompaniesForReportingGroupForm(),
  ]);

  if (!groupResult.ok) {
    if (groupResult.status === 403) {
      redirect("/");
    }
    redirect("/settings/reporting-groups");
  }
  if (!companiesResult.ok) {
    redirect("/");
  }

  const group = groupResult.data;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-8">
      <Card>
        <CardHeader className="grid gap-2">
          <h1 className="text-lg font-semibold">Edit reporting group</h1>
          <CardDescription>
            Update group details and company assignments. This does not change company access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReportingGroupForm
            groupId={group.id}
            submitLabel="Save group"
            companies={companiesResult.data.map((company) => ({
              id: company.id,
              displayName: company.displayName,
              status: company.status,
            }))}
            defaultValues={{
              name: group.name,
              code: group.code,
              status: group.status,
              displayOrder: group.displayOrder,
              companyIds: [...group.companyIds],
            }}
          />
        </CardContent>
      </Card>
    </main>
  );
}
