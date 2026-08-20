import Link from "next/link";

import { Button } from "@/components/ui/button";
import { authorizePermission } from "@/domain/authz/authorize";
import { getAuthenticatedIdentity } from "@/server/auth/session";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { loadCompanyContextForLayout } from "@/server/company-context/actions";

export const dynamic = "force-dynamic";

export default async function Home() {
  const identity = await getAuthenticatedIdentity();
  const principal = await getRequestAuthorizationPrincipal();
  const canManageUsers = authorizePermission(principal, "user.manage").allowed;
  const canWriteCompanies = authorizePermission(principal, "company.write").allowed;
  const canManageSettings = authorizePermission(principal, "settings.manage").allowed;
  const canManageCurrencies = authorizePermission(principal, "currency.manage").allowed;
  const context = await loadCompanyContextForLayout();

  const selection = context.selection;
  const contextLabel =
    selection?.kind === "all"
      ? "All Companies (reporting)"
      : selection?.kind === "company"
        ? (context.companies.find((company) => company.id === selection.companyId)?.displayName ??
          selection.companyId)
        : "No company context";

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 p-8">
      <div className="grid gap-2">
        <h1 className="text-xl font-semibold">Signed in</h1>
        <p className="text-muted-foreground text-sm">
          Authenticated as {identity?.email}. Authorization uses application roles and permissions.
        </p>
        <p className="text-muted-foreground text-sm" data-testid="active-company-context">
          Active company context: {contextLabel}
        </p>
      </div>
      {canWriteCompanies ? (
        <Button asChild>
          <Link href="/companies">Manage companies</Link>
        </Button>
      ) : null}
      {canWriteCompanies ? (
        <Button asChild variant="outline">
          <Link href="/settings/reporting-groups">Reporting groups</Link>
        </Button>
      ) : null}
      {canManageSettings ? (
        <Button asChild variant="outline">
          <Link href="/settings/system">System settings</Link>
        </Button>
      ) : null}
      {canManageCurrencies ? (
        <Button asChild variant="outline">
          <Link href="/settings/currencies">Currencies</Link>
        </Button>
      ) : null}
      {canManageCurrencies ? (
        <Button asChild variant="outline">
          <Link href="/settings/fixed-rates">Fixed rate versions</Link>
        </Button>
      ) : null}
      {canManageUsers ? (
        <Button asChild>
          <Link href="/users">Manage users</Link>
        </Button>
      ) : null}
    </main>
  );
}
