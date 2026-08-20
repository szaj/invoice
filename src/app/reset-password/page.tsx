import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { ResetPasswordForm } from "@/app/reset-password/reset-password-form";
import { PASSWORD_RESET_EXPIRED_LINK, PASSWORD_RESET_INVALID_LINK } from "@/domain/auth/errors";
import { canSetNewPassword } from "@/server/auth/password-reset-access";

export const dynamic = "force-dynamic";

function recoveryErrorMessage(reason: string | undefined): string {
  if (reason === "expired") {
    return PASSWORD_RESET_EXPIRED_LINK;
  }

  return PASSWORD_RESET_INVALID_LINK;
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const canReset = await canSetNewPassword();
  const params = await searchParams;

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="grid gap-2">
          <h1 className="text-lg leading-none font-semibold">Reset password</h1>
          <CardDescription>
            {canReset
              ? "Choose a new password for your account."
              : "This reset link could not be used."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {canReset ? (
            <ResetPasswordForm />
          ) : (
            <>
              <p className="text-destructive text-sm">{recoveryErrorMessage(params.reason)}</p>
              <p className="text-center text-sm">
                <Link
                  href="/forgot-password"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Request a new recovery email
                </Link>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
