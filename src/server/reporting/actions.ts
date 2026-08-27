"use server";

import { authorizePermission } from "@/domain/authz/authorize";
import type {
  CustomerReportQuery,
  DashboardKpiQuery,
  InvoiceReportQuery,
  OutstandingReportQuery,
  OverdueAgingQuery,
  PaymentReportQuery,
} from "@/domain/reporting/schema";
import type {
  CustomerReportPayload,
  DashboardKpiPayload,
  InvoiceReportPayload,
  OutstandingReportPayload,
  OverdueAgingPayload,
  PaymentReportPayload,
} from "@/domain/reporting/types";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { loadCompanyContextForLayout } from "@/server/company-context/actions";
import { getCustomerReport } from "@/server/reporting/customer-report-service";
import { PrismaCustomerReportStore } from "@/server/reporting/customer-report-repository";
import { getDashboardKpis } from "@/server/reporting/dashboard-service";
import { PrismaDashboardStore } from "@/server/reporting/dashboard-repository";
import { getInvoiceReport } from "@/server/reporting/invoice-report-service";
import { PrismaInvoiceReportStore } from "@/server/reporting/invoice-report-repository";
import { getOutstandingReport } from "@/server/reporting/outstanding-report-service";
import { PrismaOutstandingReportStore } from "@/server/reporting/outstanding-report-repository";
import { getOverdueAgingReport } from "@/server/reporting/overdue-aging-service";
import { PrismaOverdueAgingStore } from "@/server/reporting/overdue-aging-repository";
import { getPaymentReport } from "@/server/reporting/payment-report-service";
import { PrismaPaymentReportStore } from "@/server/reporting/payment-report-repository";

export type DashboardCompanyOption = { id: string; displayName: string };
export type DashboardReportingGroupOption = { id: string; name: string };

export type DashboardUiOptions = {
  readonly companies: readonly DashboardCompanyOption[];
  readonly reportingGroups: readonly DashboardReportingGroupOption[];
  readonly defaultCompanyId: string | null;
  readonly allowsAllCompanies: boolean;
};

export type InvoiceReportUiOptions = DashboardUiOptions;
export type PaymentReportUiOptions = DashboardUiOptions;
export type OutstandingReportUiOptions = DashboardUiOptions;
export type OverdueAgingUiOptions = DashboardUiOptions;
export type CustomerReportUiOptions = DashboardUiOptions;

export async function loadDashboardOptions(
  preferredCompanyId?: string,
): Promise<{ ok: true; data: DashboardUiOptions } | { ok: false; error: string }> {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "dashboard.view").allowed || !actor) {
    return { ok: false, error: "forbidden" };
  }

  const context = await loadCompanyContextForLayout();
  const companies = context.companies.map((company) => ({
    id: company.id,
    displayName: company.displayName,
  }));

  const store = new PrismaDashboardStore();
  const reportingGroups = await store.listReportingGroupOptions();

  const selection = context.selection;
  const contextCompanyId = selection?.kind === "company" ? selection.companyId : null;
  const defaultCompanyId =
    preferredCompanyId && companies.some((c) => c.id === preferredCompanyId)
      ? preferredCompanyId
      : contextCompanyId && companies.some((c) => c.id === contextCompanyId)
        ? contextCompanyId
        : null;

  return {
    ok: true,
    data: {
      companies,
      reportingGroups,
      defaultCompanyId,
      allowsAllCompanies: context.allowsAllCompanies,
    },
  };
}

export async function loadDashboardKpisForUi(
  query: DashboardKpiQuery,
): Promise<{ ok: true; data: DashboardKpiPayload } | { ok: false; status: number; error: string }> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await getDashboardKpis(actor, query);
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error };
  }
  return { ok: true, data: result.data };
}

export async function loadInvoiceReportOptions(
  preferredCompanyId?: string,
): Promise<{ ok: true; data: InvoiceReportUiOptions } | { ok: false; error: string }> {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "report.view").allowed || !actor) {
    return { ok: false, error: "forbidden" };
  }

  const context = await loadCompanyContextForLayout();
  const companies = context.companies.map((company) => ({
    id: company.id,
    displayName: company.displayName,
  }));

  const store = new PrismaInvoiceReportStore();
  const reportingGroups = await store.listReportingGroupOptions();

  const selection = context.selection;
  const contextCompanyId = selection?.kind === "company" ? selection.companyId : null;
  const defaultCompanyId =
    preferredCompanyId && companies.some((c) => c.id === preferredCompanyId)
      ? preferredCompanyId
      : contextCompanyId && companies.some((c) => c.id === contextCompanyId)
        ? contextCompanyId
        : null;

  return {
    ok: true,
    data: {
      companies,
      reportingGroups,
      defaultCompanyId,
      allowsAllCompanies: context.allowsAllCompanies,
    },
  };
}

export async function loadInvoiceReportForUi(
  query: InvoiceReportQuery,
): Promise<
  { ok: true; data: InvoiceReportPayload } | { ok: false; status: number; error: string }
> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await getInvoiceReport(actor, query);
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error };
  }
  return { ok: true, data: result.data };
}

export async function loadPaymentReportOptions(
  preferredCompanyId?: string,
): Promise<{ ok: true; data: PaymentReportUiOptions } | { ok: false; error: string }> {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "report.view").allowed || !actor) {
    return { ok: false, error: "forbidden" };
  }

  const context = await loadCompanyContextForLayout();
  const companies = context.companies.map((company) => ({
    id: company.id,
    displayName: company.displayName,
  }));

  const store = new PrismaPaymentReportStore();
  const reportingGroups = await store.listReportingGroupOptions();

  const selection = context.selection;
  const contextCompanyId = selection?.kind === "company" ? selection.companyId : null;
  const defaultCompanyId =
    preferredCompanyId && companies.some((c) => c.id === preferredCompanyId)
      ? preferredCompanyId
      : contextCompanyId && companies.some((c) => c.id === contextCompanyId)
        ? contextCompanyId
        : null;

  return {
    ok: true,
    data: {
      companies,
      reportingGroups,
      defaultCompanyId,
      allowsAllCompanies: context.allowsAllCompanies,
    },
  };
}

export async function loadPaymentReportForUi(
  query: PaymentReportQuery,
): Promise<
  { ok: true; data: PaymentReportPayload } | { ok: false; status: number; error: string }
> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await getPaymentReport(actor, query);
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error };
  }
  return { ok: true, data: result.data };
}

export async function loadOutstandingReportOptions(
  preferredCompanyId?: string,
): Promise<{ ok: true; data: OutstandingReportUiOptions } | { ok: false; error: string }> {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "report.view").allowed || !actor) {
    return { ok: false, error: "forbidden" };
  }

  const context = await loadCompanyContextForLayout();
  const companies = context.companies.map((company) => ({
    id: company.id,
    displayName: company.displayName,
  }));

  const store = new PrismaOutstandingReportStore();
  const reportingGroups = await store.listReportingGroupOptions();

  const selection = context.selection;
  const contextCompanyId = selection?.kind === "company" ? selection.companyId : null;
  const defaultCompanyId =
    preferredCompanyId && companies.some((c) => c.id === preferredCompanyId)
      ? preferredCompanyId
      : contextCompanyId && companies.some((c) => c.id === contextCompanyId)
        ? contextCompanyId
        : null;

  return {
    ok: true,
    data: {
      companies,
      reportingGroups,
      defaultCompanyId,
      allowsAllCompanies: context.allowsAllCompanies,
    },
  };
}

export async function loadOutstandingReportForUi(
  query: OutstandingReportQuery,
): Promise<
  { ok: true; data: OutstandingReportPayload } | { ok: false; status: number; error: string }
> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await getOutstandingReport(actor, query);
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error };
  }
  return { ok: true, data: result.data };
}

export async function loadOverdueAgingOptions(
  preferredCompanyId?: string,
): Promise<{ ok: true; data: OverdueAgingUiOptions } | { ok: false; error: string }> {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "report.view").allowed || !actor) {
    return { ok: false, error: "forbidden" };
  }

  const context = await loadCompanyContextForLayout();
  const companies = context.companies.map((company) => ({
    id: company.id,
    displayName: company.displayName,
  }));

  const store = new PrismaOverdueAgingStore();
  const reportingGroups = await store.listReportingGroupOptions();

  const selection = context.selection;
  const contextCompanyId = selection?.kind === "company" ? selection.companyId : null;
  const defaultCompanyId =
    preferredCompanyId && companies.some((c) => c.id === preferredCompanyId)
      ? preferredCompanyId
      : contextCompanyId && companies.some((c) => c.id === contextCompanyId)
        ? contextCompanyId
        : null;

  return {
    ok: true,
    data: {
      companies,
      reportingGroups,
      defaultCompanyId,
      allowsAllCompanies: context.allowsAllCompanies,
    },
  };
}

export async function loadOverdueAgingForUi(
  query: OverdueAgingQuery,
): Promise<{ ok: true; data: OverdueAgingPayload } | { ok: false; status: number; error: string }> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await getOverdueAgingReport(actor, query);
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error };
  }
  return { ok: true, data: result.data };
}

export async function loadCustomerReportOptions(
  preferredCompanyId?: string,
): Promise<{ ok: true; data: CustomerReportUiOptions } | { ok: false; error: string }> {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "report.view").allowed || !actor) {
    return { ok: false, error: "forbidden" };
  }

  const context = await loadCompanyContextForLayout();
  const companies = context.companies.map((company) => ({
    id: company.id,
    displayName: company.displayName,
  }));

  const store = new PrismaCustomerReportStore();
  const reportingGroups = await store.listReportingGroupOptions();

  const selection = context.selection;
  const contextCompanyId = selection?.kind === "company" ? selection.companyId : null;
  const defaultCompanyId =
    preferredCompanyId && companies.some((c) => c.id === preferredCompanyId)
      ? preferredCompanyId
      : contextCompanyId && companies.some((c) => c.id === contextCompanyId)
        ? contextCompanyId
        : null;

  return {
    ok: true,
    data: {
      companies,
      reportingGroups,
      defaultCompanyId,
      allowsAllCompanies: context.allowsAllCompanies,
    },
  };
}

export async function loadCustomerReportForUi(
  query: CustomerReportQuery,
): Promise<
  { ok: true; data: CustomerReportPayload } | { ok: false; status: number; error: string }
> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await getCustomerReport(actor, query);
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error };
  }
  return { ok: true, data: result.data };
}
