import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { loadReportingGroupsForAdmin } from "@/server/reporting-groups/actions";

export const dynamic = "force-dynamic";

export default async function ReportingGroupsPage() {
  const result = await loadReportingGroupsForAdmin();
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
          <h1 className="text-xl font-semibold">Reporting Groups</h1>
          <p className="text-muted-foreground text-sm">
            Optional parent groups for consolidated report roll-ups. Group membership does not grant
            company access.
          </p>
        </div>
        <Button asChild>
          <Link href="/settings/reporting-groups/new">Create group</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardDescription>{result.data.length} group(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Code</th>
                  <th className="py-2 pr-4 font-medium">Companies</th>
                  <th className="py-2 pr-4 font-medium">Order</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((group) => (
                  <tr key={group.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      <Link
                        href={`/settings/reporting-groups/${group.id}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {group.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{group.code}</td>
                    <td className="py-2 pr-4">{group.companyIds.length}</td>
                    <td className="py-2 pr-4">{group.displayOrder}</td>
                    <td className="py-2">{group.status}</td>
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
