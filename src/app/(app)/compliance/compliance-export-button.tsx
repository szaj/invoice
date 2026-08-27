"use client";

import { Button } from "@/components/ui/button";
import type { ComplianceQueueFilterValues } from "@/app/(app)/compliance/compliance-queue-filters";

function buildExportHref(filters: ComplianceQueueFilterValues): string {
  const params = new URLSearchParams();
  if (filters.companyId) {
    params.set("companyId", filters.companyId);
  }
  if (filters.staffUserId.trim()) {
    params.set("staffUserId", filters.staffUserId.trim());
  }
  if (filters.dateFrom) {
    params.set("dateFrom", filters.dateFrom);
  }
  if (filters.dateTo) {
    params.set("dateTo", filters.dateTo);
  }
  if (filters.amountMin.trim()) {
    params.set("amountMin", filters.amountMin.trim());
  }
  if (filters.amountMax.trim()) {
    params.set("amountMax", filters.amountMax.trim());
  }
  if (filters.gateway) {
    params.set("gateway", filters.gateway);
  }
  if (filters.currency.trim()) {
    params.set("currency", filters.currency.trim().toUpperCase());
  }
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.subjectType) {
    params.set("subjectType", filters.subjectType);
  }
  const query = params.toString();
  return query ? `/api/compliance/export?${query}` : "/api/compliance/export";
}

/**
 * Download link for compliance CSV export (TASK-075).
 * Visible only when the caller already gated report.export.
 */
export function ComplianceExportButton({ filters }: { filters: ComplianceQueueFilterValues }) {
  return (
    <Button asChild variant="outline">
      <a href={buildExportHref(filters)} download>
        Export CSV
      </a>
    </Button>
  );
}
