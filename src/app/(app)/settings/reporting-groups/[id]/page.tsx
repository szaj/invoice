import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { loadReportingGroupForAdmin } from "@/server/reporting-groups/actions";
import { ReportingGroupStatusControls } from "@/app/(app)/settings/reporting-groups/[id]/status-controls";

export const dynamic = "force-dynamic";

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="grid gap-1">
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</dt>
      <dd className="text-sm">
        {value === null || value === undefined || value === "" ? "—" : value}
      </dd>
    </div>
  );
}

export default async function ReportingGroupViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await loadReportingGroupForAdmin(id);

  if (!result.ok) {
    if (result.status === 403) {
      redirect("/");
    }
    if (result.status === 404) {
      redirect("/settings/reporting-groups");
    }
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p className="text-destructive text-sm">{result.error}</p>
      </main>
    );
  }

  const group = result.data;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-8">
      <Card>
        <CardHeader className="grid gap-2">
          <h1 className="text-lg font-semibold">{group.name}</h1>
          <CardDescription>
            Reporting group for consolidated roll-ups. Membership is not company authorization.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" value={group.name} />
            <Field label="Code" value={group.code} />
            <Field label="Status" value={group.status} />
            <Field label="Display order" value={group.displayOrder} />
          </dl>

          <div className="grid gap-2">
            <h2 className="text-sm font-semibold">Assigned companies</h2>
            {group.companies.length === 0 ? (
              <p className="text-muted-foreground text-sm">No companies assigned.</p>
            ) : (
              <ul className="grid gap-1 text-sm">
                {group.companies.map((company) => (
                  <li key={company.id}>
                    <Link
                      href={`/companies/${company.id}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {company.displayName}
                    </Link>
                    {company.status === "INACTIVE" ? " (inactive)" : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={`/settings/reporting-groups/${group.id}/edit`}>Edit</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/settings/reporting-groups">Back to list</Link>
            </Button>
          </div>
          <ReportingGroupStatusControls groupId={group.id} status={group.status} />
        </CardContent>
      </Card>
    </main>
  );
}
