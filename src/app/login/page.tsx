import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { LoginForm } from "@/app/login/login-form";
import { getAuthenticatedIdentity } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const identity = await getAuthenticatedIdentity();
  if (identity) {
    redirect("/");
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="grid gap-2">
          <h1 className="text-lg leading-none font-semibold">Sign in</h1>
          <CardDescription>
            Internal invoicing platform. Accounts are provisioned by an administrator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
