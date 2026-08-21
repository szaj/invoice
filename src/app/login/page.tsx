import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoginForm } from "@/app/login/login-form";
import { ACCOUNT_SUSPENDED, PASSWORD_RESET_SUCCEEDED } from "@/domain/auth/errors";
import { getAuthenticatedIdentity } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; error?: string }>;
}) {
  const identity = await getAuthenticatedIdentity();
  if (identity) {
    redirect("/");
  }

  const params = await searchParams;
  const resetSucceeded = params.reset === "success";
  const suspended = params.error === "suspended";

  return (
    <main className="bg-background flex min-h-svh flex-col items-center justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <p className="text-2xl font-semibold tracking-tight">Invoices</p>
        <p className="text-muted-foreground mt-1 text-sm">Multi-brand invoice platform</p>
      </div>
      <Card className="w-full max-w-sm shadow-sm">
        <CardHeader>
          <h1 className="text-base leading-none font-semibold">Sign in</h1>
          <CardDescription>
            Internal invoicing platform. Accounts are provisioned by an administrator.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {resetSucceeded ? (
            <Alert variant="success">
              <AlertDescription>{PASSWORD_RESET_SUCCEEDED}</AlertDescription>
            </Alert>
          ) : null}
          {suspended ? (
            <Alert variant="destructive">
              <AlertDescription>{ACCOUNT_SUSPENDED}</AlertDescription>
            </Alert>
          ) : null}
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
