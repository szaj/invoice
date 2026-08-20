import Link from "next/link";

import { CompanySwitcher } from "@/app/(app)/company-switcher";
import { LogoutButton } from "@/app/(app)/logout-button";
import { ALL_COMPANIES_CONTEXT_VALUE } from "@/domain/company-context/types";
import { serializeCompanyContextSelection } from "@/domain/company-context/resolve";
import { loadCompanyContextForLayout } from "@/server/company-context/actions";

export async function AppHeader() {
  const context = await loadCompanyContextForLayout();
  const selectedValue =
    context.selection != null
      ? serializeCompanyContextSelection(context.selection)
      : context.allowsAllCompanies
        ? ALL_COMPANIES_CONTEXT_VALUE
        : (context.companies[0]?.id ?? "");

  return (
    <header className="border-border bg-background border-b">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            Invoices
          </Link>
          <CompanySwitcher
            allowsAllCompanies={context.allowsAllCompanies}
            companies={context.companies}
            selectedValue={selectedValue}
          />
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}
