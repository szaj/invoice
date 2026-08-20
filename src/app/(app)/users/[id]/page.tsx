import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { EditUserForm } from "@/app/(app)/users/[id]/edit-user-form";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { loadAssignableCompaniesForAdmin, loadUserForAdmin } from "@/server/users/actions";

export const dynamic = "force-dynamic";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getRequestAuthorizationPrincipal();
  const result = await loadUserForAdmin(id);
  const companies = await loadAssignableCompaniesForAdmin();

  if (!result.ok) {
    if (result.status === 403) {
      redirect("/");
    }
    if (result.status === 404) {
      redirect("/users");
    }
    return (
      <main className="mx-auto max-w-lg p-8">
        <p className="text-destructive text-sm">{result.error}</p>
      </main>
    );
  }

  const canSuspend = actor?.userId !== result.data.id;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 p-8">
      <Card>
        <CardHeader className="grid gap-2">
          <h1 className="text-lg font-semibold">Edit user</h1>
          <CardDescription>
            Role, status, and company assignments are application authorization. Password reset
            required is workflow-only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditUserForm
            user={{
              ...result.data,
              lastLoginAt: result.data.lastLoginAt?.toISOString() ?? null,
              createdAt: result.data.createdAt.toISOString(),
              updatedAt: result.data.updatedAt.toISOString(),
            }}
            canSuspend={canSuspend}
            companies={companies.ok ? companies.data : []}
          />
        </CardContent>
      </Card>
    </main>
  );
}
