import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { CreateUserForm } from "@/app/(app)/users/create-user-form";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { authorizePermission } from "@/domain/authz/authorize";
import { loadAssignableCompaniesForAdmin } from "@/server/users/actions";

export const dynamic = "force-dynamic";

export default async function NewUserPage() {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "user.manage").allowed) {
    redirect("/");
  }

  const companies = await loadAssignableCompaniesForAdmin();

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 p-8">
      <Card>
        <CardHeader className="grid gap-2">
          <h1 className="text-lg font-semibold">Create user</h1>
          <CardDescription>
            Creates a Supabase Auth identity and application user. Company assignments constrain
            Compliance and Staff.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateUserForm companies={companies.ok ? companies.data : []} />
        </CardContent>
      </Card>
    </main>
  );
}
