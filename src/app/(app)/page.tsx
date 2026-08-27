import Link from "next/link";

import { DashboardFilters, type DashboardFilterValues } from "@/app/(app)/dashboard-filters";
import { DashboardKpiPanel } from "@/app/(app)/dashboard-kpi-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { authorizePermission } from "@/domain/authz/authorize";
import { parseDashboardKpiSearchParams } from "@/domain/reporting/schema";
import { getAuthenticatedIdentity } from "@/server/auth/session";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { loadCompanyContextForLayout } from "@/server/company-context/actions";
import { loadDashboardKpisForUi, loadDashboardOptions } from "@/server/reporting/actions";

export const dynamic = "force-dynamic";

type QuickLink = {
  href: string;
  label: string;
  description: string;
};

function toDateInputValue(value: Date | undefined): string {
  if (!value) {
    return "";
  }
  return value.toISOString().slice(0, 10);
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const identity = await getAuthenticatedIdentity();
  const principal = await getRequestAuthorizationPrincipal();
  const canViewDashboard = authorizePermission(principal, "dashboard.view").allowed;
  const canManageUsers = authorizePermission(principal, "user.manage").allowed;
  const canWriteCompanies = authorizePermission(principal, "company.write").allowed;
  const canManageSettings = authorizePermission(principal, "settings.manage").allowed;
  const canManageCurrencies = authorizePermission(principal, "currency.manage").allowed;
  const canEditCustomers = authorizePermission(principal, "customer.edit").allowed;
  const canCreateInvoices = authorizePermission(principal, "invoice.create").allowed;
  const canReadAudit = authorizePermission(principal, "audit.read").allowed;
  const canViewReports = authorizePermission(principal, "report.view").allowed;
  const context = await loadCompanyContextForLayout();

  const selection = context.selection;
  const contextLabel =
    selection?.kind === "all"
      ? "All Companies (reporting)"
      : selection?.kind === "company"
        ? (context.companies.find((company) => company.id === selection.companyId)?.displayName ??
          selection.companyId)
        : "No company context";

  const params = await searchParams;
  const query = parseDashboardKpiSearchParams(params);
  const options = canViewDashboard ? await loadDashboardOptions(query.companyId) : null;

  const companyId =
    query.companyId ?? (options?.ok ? (options.data.defaultCompanyId ?? undefined) : undefined);
  const kpiQuery = {
    ...query,
    ...(companyId ? { companyId } : {}),
  };

  const kpiResult = canViewDashboard && options?.ok ? await loadDashboardKpisForUi(kpiQuery) : null;

  const filterValues: DashboardFilterValues = {
    companyId: companyId ?? "",
    customerId: query.customerId ?? "",
    staffUserId: query.staffUserId ?? "",
    reportingGroupId: query.reportingGroupId ?? "",
    dateFrom: toDateInputValue(query.dateFrom),
    dateTo: toDateInputValue(query.dateTo),
    invoiceStatus: query.invoiceStatus ?? "",
    paymentStatus: query.paymentStatus ?? "",
    paymentMethod: query.paymentMethod ?? "",
    invoiceCurrency: query.invoiceCurrency ?? "",
    settlementCurrency: query.settlementCurrency ?? "",
    countryCode: query.countryCode ?? "",
    complianceStatus: query.complianceStatus ?? "",
  };

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
    links.push({
      href: "/payments",
      label: "Payments",
      description: "Browse company-scoped payment transactions.",
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
  if (canViewReports) {
    links.push({
      href: "/reports/invoices",
      label: "Invoice report",
      description: "Filterable invoice list with totals, paid, balance, and staff.",
    });
    links.push({
      href: "/reports/payments",
      label: "Payment report",
      description: "Payments with stored rate snapshots, settlement, and optional fees.",
    });
    links.push({
      href: "/reports/customers",
      label: "Customer report",
      description: "Invoiced, paid, and outstanding totals by customer and currency.",
    });
  }
  if (canReadAudit) {
    links.push({
      href: "/audit",
      label: "Audit logs",
      description: "Read-only history of privileged actions.",
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
        title="Dashboard"
        description="KPI cards by original and settlement currency. Use the company switcher or filters to scope totals."
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

      {canViewDashboard && options?.ok ? (
        <section className="grid gap-3">
          <h2 className="text-sm font-semibold">Filters</h2>
          <DashboardFilters
            initial={filterValues}
            companies={options.data.companies}
            reportingGroups={options.data.reportingGroups}
            allowsAllCompanies={options.data.allowsAllCompanies}
          />
          {kpiResult && !kpiResult.ok ? (
            <Alert variant="destructive">
              <AlertDescription>{kpiResult.error}</AlertDescription>
            </Alert>
          ) : null}
          {kpiResult?.ok ? <DashboardKpiPanel kpis={kpiResult.data} /> : null}
        </section>
      ) : null}

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
