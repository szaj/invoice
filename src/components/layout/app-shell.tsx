import Link from "next/link";
import type { ReactNode } from "react";

import { CompanySwitcher, type CompanySwitcherOption } from "@/app/(app)/company-switcher";
import { LogoutButton } from "@/app/(app)/logout-button";
import { AppSidebarNav, filterNavGroups } from "@/components/layout/app-sidebar-nav";
import { APP_NAV_GROUPS } from "@/components/layout/nav-config";
import { MobileNav } from "@/components/layout/mobile-nav";
import { authorizePermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import type { CompanyContextSelection } from "@/domain/company-context/types";
import { ALL_COMPANIES_CONTEXT_VALUE } from "@/domain/company-context/types";
import { serializeCompanyContextSelection } from "@/domain/company-context/resolve";

type AppShellCompanyContext = {
  readonly selection: CompanyContextSelection | null;
  readonly companies: ReadonlyArray<{ id: string; displayName: string; status: string }>;
  readonly allowsAllCompanies: boolean;
};

type AppShellProps = {
  children: ReactNode;
  actor: AuthorizationPrincipal | null;
  identityEmail: string | null;
  companyContext: AppShellCompanyContext;
};

function buildAllowedHrefs(actor: AuthorizationPrincipal | null): Set<string> {
  const allowed = new Set<string>();
  for (const group of APP_NAV_GROUPS) {
    for (const item of group.items) {
      if (!item.permissions || item.permissions.length === 0) {
        allowed.add(item.href);
        continue;
      }
      if (item.permissions.some((code) => authorizePermission(actor, code).allowed)) {
        allowed.add(item.href);
      }
    }
  }
  return allowed;
}

export function AppShell({ children, actor, identityEmail, companyContext }: AppShellProps) {
  const groups = filterNavGroups(buildAllowedHrefs(actor));
  const selectedValue =
    companyContext.selection != null
      ? serializeCompanyContextSelection(companyContext.selection)
      : companyContext.allowsAllCompanies
        ? ALL_COMPANIES_CONTEXT_VALUE
        : (companyContext.companies[0]?.id ?? "");

  const companies: CompanySwitcherOption[] = companyContext.companies.map((company) => ({
    id: company.id,
    displayName: company.displayName,
    status: company.status,
  }));

  return (
    <div className="bg-background flex min-h-svh">
      <aside className="border-sidebar-border bg-sidebar text-sidebar-foreground hidden w-56 shrink-0 flex-col border-r lg:flex xl:w-60">
        <div className="flex h-14 items-center border-b px-4">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            Invoices
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <AppSidebarNav groups={groups} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border bg-card/80 sticky top-0 z-30 border-b backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <MobileNav groups={groups} />
              <Link href="/" className="text-sm font-semibold tracking-tight lg:hidden">
                Invoices
              </Link>
              <CompanySwitcher
                allowsAllCompanies={companyContext.allowsAllCompanies}
                companies={companies}
                selectedValue={selectedValue}
              />
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {identityEmail ? (
                <p className="text-muted-foreground hidden max-w-[14rem] truncate text-xs sm:block">
                  {identityEmail}
                </p>
              ) : null}
              <LogoutButton />
            </div>
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
