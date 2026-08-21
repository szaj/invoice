"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ALL_COMPANIES_CONTEXT_VALUE } from "@/domain/company-context/types";
import { setCompanyContextAction } from "@/server/company-context/actions";

export type CompanySwitcherOption = {
  readonly id: string;
  readonly displayName: string;
  readonly status: string;
};

type CompanySwitcherProps = {
  readonly allowsAllCompanies: boolean;
  readonly companies: readonly CompanySwitcherOption[];
  readonly selectedValue: string;
};

export function CompanySwitcher({
  allowsAllCompanies,
  companies,
  selectedValue,
}: CompanySwitcherProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState(selectedValue);

  function onChange(next: string) {
    setError(null);
    setValue(next);
    startTransition(async () => {
      const result = await setCompanyContextAction(next);
      if (!result.ok) {
        setError(result.error);
        setValue(selectedValue);
        return;
      }
      router.refresh();
    });
  }

  if (!allowsAllCompanies && companies.length === 0) {
    return (
      <p className="text-muted-foreground text-sm" data-testid="company-switcher-empty">
        No companies assigned
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="sr-only" htmlFor="company-context-switcher">
        Company
      </label>
      <select
        id="company-context-switcher"
        data-testid="company-switcher"
        className="border-input bg-background focus-visible:ring-ring h-9 max-w-[14rem] rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 disabled:opacity-50"
        value={value}
        disabled={pending}
        onChange={(event) => onChange(event.target.value)}
      >
        {allowsAllCompanies ? (
          <option value={ALL_COMPANIES_CONTEXT_VALUE}>All Companies</option>
        ) : null}
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.displayName}
            {company.status === "INACTIVE" ? " (Inactive)" : ""}
          </option>
        ))}
      </select>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
