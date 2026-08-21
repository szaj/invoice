import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/layout/page-header";
import { authorizePermission } from "@/domain/authz/authorize";
import { getAuthenticatedIdentity } from "@/server/auth/session";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { loadCompanyContextForLayout } from "@/server/company-context/actions";

export const dynamic = "force-dynamic";

type QuickLink = {
  href: string;
  label: string;
  description: string;
};

export default async function Home() {
  const identity = await getAuthenticatedIdentity();
  const principal = await getRequestAuthorizationPrincipal();
  const canManageUsers = authorizePermission(principal, "user.manage").allowed;
  const canWriteCompanies = authorizePermission(principal, "company.write").allowed;
  const canManageSettings = authorizePermission(principal, "settings.manage").allowed;
  const canManageCurrencies = authorizePermission(principal, "currency.manage").allowed;
  const canEditCustomers = authorizePermission(principal, "customer.edit").allowed;
  const canCreateInvoices = authorizePermission(principal, "invoice.create").allowed;
  const context = await loadCompanyContextForLayout();

  const selection = context.selection;
  const contextLabel =
    selection?.kind === "all"
      ? "All Companies (reporting)"
      : selection?.kind === "company"
        ? (context.companies.find((company) => company.id === selection.companyId)?.displayName ??
          selection.companyId)
        : "No company context";

  const links: QuickLink[] = [];
  if (canEditCustomers) {
    links.push({
      href: "/customers",
      label: "Customers",
      description: "Search and maintain customer master records.",
    });
  }
  if (canCreateInvoices) {
    links.push({
      href: "/invoices",
      label: "Invoices",
      description: "Create drafts, issue invoices, and review totals.",
    });
  }
  if (canWriteCompanies) {
    links.push({
      href: "/companies",
      label: "Companies",
      description: "Manage brands, branding, and company currencies.",
    });
    links.push({
      href: "/settings/reporting-groups",
      label: "Reporting groups",
      description: "Organize companies for consolidated reporting.",
    });
  }
  if (canManageSettings) {
    links.push({
      href: "/settings/system",
      label: "System settings",
      description: "Platform-wide configuration.",
    });
  }
  if (canManageCurrencies) {
    links.push({
      href: "/settings/currencies",
      label: "Currencies",
      description: "Global currency catalog and status.",
    });
    links.push({
      href: "/settings/fixed-rates",
      label: "Fixed rates",
      description: "Admin-defined conversion rate versions.",
    });
  }
  if (canManageUsers) {
    links.push({
      href: "/users",
      label: "Users",
      description: "Provision accounts, roles, and company assignments.",
    });
  }

  return (
    <PageFrame>
      <PageHeader
        title="Home"
        description="Multi-brand invoicing workspace. Authorization uses application roles and permissions."
      />

      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>Signed-in identity and active company context.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <p>
            <span className="text-muted-foreground">Authenticated as </span>
            {identity?.email}
          </p>
          <p data-testid="active-company-context">
            <span className="text-muted-foreground">Active company context: </span>
            {contextLabel}
          </p>
        </CardContent>
      </Card>

      {links.length > 0 ? (
        <section className="grid gap-3">
          <h2 className="text-sm font-semibold">Shortcuts</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {links.map((link) => (
              <Card key={link.href} className="hover:bg-muted/30 transition-colors">
                <CardHeader className="border-0 pb-0">
                  <CardTitle className="text-sm">
                    <Link href={link.href} className="hover:underline">
                      {link.label}
                    </Link>
                  </CardTitle>
                  <CardDescription>{link.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={link.href}>Open</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </PageFrame>
  );
}
