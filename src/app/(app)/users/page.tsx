import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { loadUsersForAdmin } from "@/server/users/actions";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const result = await loadUsersForAdmin();
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
          <h1 className="text-xl font-semibold">Users</h1>
          <p className="text-muted-foreground text-sm">
            Admin user management. Company assignments constrain Compliance and Staff; Admin may
            access all companies.
          </p>
        </div>
        <Button asChild>
          <Link href="/users/new">Create user</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardDescription>{result.data.length} user(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">Role</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 font-medium">Reset required</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((user) => (
                  <tr key={user.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      <Link
                        href={`/users/${user.id}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {user.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{user.email}</td>
                    <td className="py-2 pr-4">{user.roleName ?? "Unassigned"}</td>
                    <td className="py-2 pr-4">{user.status}</td>
                    <td className="py-2">{user.passwordResetRequired ? "Yes" : "No"}</td>
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
