import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getAuthenticatedIdentity } from "@/server/auth/session";
import { requiresPasswordReset } from "@/server/auth/password-reset-access";
import { enforceActiveApplicationUser } from "@/server/auth/active-user";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { loadCompanyContextForLayout } from "@/server/company-context/actions";

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

  const [actor, companyContext] = await Promise.all([
    getRequestAuthorizationPrincipal(),
    loadCompanyContextForLayout(),
  ]);

  return (
    <AppShell actor={actor} identityEmail={identity.email} companyContext={companyContext}>
      {children}
    </AppShell>
  );
}
