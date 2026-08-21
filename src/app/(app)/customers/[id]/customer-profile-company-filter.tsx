"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type CompanyOption = { id: string; displayName: string };

export function CustomerProfileCompanyFilter({
  customerId,
  companies,
  initialCompanyId,
}: {
  customerId: string;
  companies: readonly CompanyOption[];
  initialCompanyId: string;
}) {
  const router = useRouter();
  const [companyId, setCompanyId] = useState(initialCompanyId);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (companyId) {
      params.set("companyId", companyId);
    }
    const query = params.toString();
    router.push(query ? `/customers/${customerId}?${query}` : `/customers/${customerId}`);
  }

  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={onSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="profile-company-filter">Company scope</Label>
        <select
          id="profile-company-filter"
          className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 max-w-[16rem] rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          value={companyId}
          onChange={(event) => setCompanyId(event.target.value)}
        >
          <option value="">All authorized companies</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.displayName}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="outline">
        Apply
      </Button>
      {initialCompanyId ? (
        <Button asChild variant="ghost">
          <Link href={`/customers/${customerId}`}>Clear</Link>
        </Button>
      ) : null}
    </form>
  );
}
