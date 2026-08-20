import { redirect } from "next/navigation";

import { AppHeader } from "@/app/(app)/app-header";
import { getAuthenticatedIdentity } from "@/server/auth/session";
import { requiresPasswordReset } from "@/server/auth/password-reset-access";
import { enforceActiveApplicationUser } from "@/server/auth/active-user";

export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const identity = await getAuthenticatedIdentity();

  if (!identity) {
    redirect("/login");
  }

  const active = await enforceActiveApplicationUser();
  if (active === "unauthenticated") {
    redirect("/login");
  }
  if (active === "suspended") {
    redirect("/login?error=suspended");
  }

  if (await requiresPasswordReset(identity.authUserId)) {
    redirect("/reset-password");
  }

  return (
    <div className="bg-background min-h-svh">
      <AppHeader />
      {children}
    </div>
  );
}
