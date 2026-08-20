import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { ForgotPasswordForm } from "@/app/forgot-password/forgot-password-form";
import { getAuthenticatedIdentity } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  const identity = await getAuthenticatedIdentity();
  if (identity) {
    redirect("/");
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="grid gap-2">
          <h1 className="text-lg leading-none font-semibold">Forgot password</h1>
          <CardDescription>
            Enter your email. If an account exists, recovery instructions will be sent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}
