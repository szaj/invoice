"use server";

import { authorizePermission } from "@/domain/authz/authorize";
import type {
  CompanyPerformanceQuery,
  ComplianceReportQuery,
  CurrencyReportQuery,
  CustomerReportQuery,
  DashboardKpiQuery,
  GatewayReportQuery,
  InvoiceReportQuery,
  OutstandingReportQuery,
  OverdueAgingQuery,
  PaymentReportQuery,
  StaffPerformanceQuery,
  MonthlyBrandMatrixQuery,
  ReportingGroupRollupQuery,
} from "@/domain/reporting/schema";
import type {
  CompanyPerformancePayload,
  ComplianceReportPayload,
  CurrencyReportPayload,
  CustomerReportPayload,
  DashboardKpiPayload,
  GatewayReportPayload,
  InvoiceReportPayload,
  OutstandingReportPayload,
  OverdueAgingPayload,
  PaymentReportPayload,
  StaffPerformancePayload,
  MonthlyBrandMatrixPayload,
  ReportingGroupRollupPayload,
} from "@/domain/reporting/types";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { loadCompanyContextForLayout } from "@/server/company-context/actions";
import { getCompanyPerformance } from "@/server/reporting/company-performance-service";
import { PrismaCompanyPerformanceStore } from "@/server/reporting/company-performance-repository";
import { getComplianceReport } from "@/server/reporting/compliance-report-service";
import { PrismaComplianceReportStore } from "@/server/reporting/compliance-report-repository";
import { getCurrencyReport } from "@/server/reporting/currency-report-service";
import { PrismaCurrencyReportStore } from "@/server/reporting/currency-report-repository";
import { getCustomerReport } from "@/server/reporting/customer-report-service";
import { PrismaCustomerReportStore } from "@/server/reporting/customer-report-repository";
import { getDashboardKpis } from "@/server/reporting/dashboard-service";
import { PrismaDashboardStore } from "@/server/reporting/dashboard-repository";
import { getGatewayReport } from "@/server/reporting/gateway-report-service";
import { PrismaGatewayReportStore } from "@/server/reporting/gateway-report-repository";
import { getInvoiceReport } from "@/server/reporting/invoice-report-service";
import { PrismaInvoiceReportStore } from "@/server/reporting/invoice-report-repository";
import { getOutstandingReport } from "@/server/reporting/outstanding-report-service";
import { PrismaOutstandingReportStore } from "@/server/reporting/outstanding-report-repository";
import { getOverdueAgingReport } from "@/server/reporting/overdue-aging-service";
import { PrismaOverdueAgingStore } from "@/server/reporting/overdue-aging-repository";
import { getPaymentReport } from "@/server/reporting/payment-report-service";
import { PrismaPaymentReportStore } from "@/server/reporting/payment-report-repository";
import { getStaffPerformance } from "@/server/reporting/staff-performance-service";
import { PrismaStaffPerformanceStore } from "@/server/reporting/staff-performance-repository";
import { getMonthlyBrandMatrix } from "@/server/reporting/monthly-brand-matrix-service";
import { PrismaMonthlyBrandMatrixStore } from "@/server/reporting/monthly-brand-matrix-repository";
import { getReportingGroupRollups } from "@/server/reporting/reporting-group-rollup-service";
import { PrismaReportingGroupRollupStore } from "@/server/reporting/reporting-group-rollup-repository";

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
export type CompanyPerformanceUiOptions = DashboardUiOptions;
export type StaffPerformanceUiOptions = DashboardUiOptions;
export type GatewayReportUiOptions = DashboardUiOptions;
export type CurrencyReportUiOptions = DashboardUiOptions;
export type ComplianceReportUiOptions = DashboardUiOptions;
export type MonthlyBrandMatrixUiOptions = DashboardUiOptions;
export type ReportingGroupRollupUiOptions = DashboardUiOptions;

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

export async function loadCompanyPerformanceOptions(
  preferredCompanyId?: string,
): Promise<{ ok: true; data: CompanyPerformanceUiOptions } | { ok: false; error: string }> {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "report.view").allowed || !actor) {
    return { ok: false, error: "forbidden" };
  }

  const context = await loadCompanyContextForLayout();
  const companies = context.companies.map((company) => ({
    id: company.id,
    displayName: company.displayName,
  }));

  const store = new PrismaCompanyPerformanceStore();
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

export async function loadCompanyPerformanceForUi(
  query: CompanyPerformanceQuery,
): Promise<
  { ok: true; data: CompanyPerformancePayload } | { ok: false; status: number; error: string }
> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await getCompanyPerformance(actor, query);
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error };
  }
  return { ok: true, data: result.data };
}

export async function loadStaffPerformanceOptions(
  preferredCompanyId?: string,
): Promise<{ ok: true; data: StaffPerformanceUiOptions } | { ok: false; error: string }> {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "report.view").allowed || !actor) {
    return { ok: false, error: "forbidden" };
  }

  const context = await loadCompanyContextForLayout();
  const companies = context.companies.map((company) => ({
    id: company.id,
    displayName: company.displayName,
  }));

  const store = new PrismaStaffPerformanceStore();
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

export async function loadStaffPerformanceForUi(
  query: StaffPerformanceQuery,
): Promise<
  { ok: true; data: StaffPerformancePayload } | { ok: false; status: number; error: string }
> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await getStaffPerformance(actor, query);
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error };
  }
  return { ok: true, data: result.data };
}

export async function loadGatewayReportOptions(
  preferredCompanyId?: string,
): Promise<{ ok: true; data: GatewayReportUiOptions } | { ok: false; error: string }> {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "report.view").allowed || !actor) {
    return { ok: false, error: "forbidden" };
  }

  const context = await loadCompanyContextForLayout();
  const companies = context.companies.map((company) => ({
    id: company.id,
    displayName: company.displayName,
  }));

  const store = new PrismaGatewayReportStore();
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

export async function loadGatewayReportForUi(
  query: GatewayReportQuery,
): Promise<
  { ok: true; data: GatewayReportPayload } | { ok: false; status: number; error: string }
> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await getGatewayReport(actor, query);
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error };
  }
  return { ok: true, data: result.data };
}

export async function loadCurrencyReportOptions(
  preferredCompanyId?: string,
): Promise<{ ok: true; data: CurrencyReportUiOptions } | { ok: false; error: string }> {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "report.view").allowed || !actor) {
    return { ok: false, error: "forbidden" };
  }

  const context = await loadCompanyContextForLayout();
  const companies = context.companies.map((company) => ({
    id: company.id,
    displayName: company.displayName,
  }));

  const store = new PrismaCurrencyReportStore();
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

export async function loadCurrencyReportForUi(
  query: CurrencyReportQuery,
): Promise<
  { ok: true; data: CurrencyReportPayload } | { ok: false; status: number; error: string }
> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await getCurrencyReport(actor, query);
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error };
  }
  return { ok: true, data: result.data };
}

export async function loadComplianceReportOptions(
  preferredCompanyId?: string,
): Promise<{ ok: true; data: ComplianceReportUiOptions } | { ok: false; error: string }> {
  const actor = await getRequestAuthorizationPrincipal();
  if (
    !authorizePermission(actor, "report.view").allowed ||
    !authorizePermission(actor, "compliance.review").allowed ||
    !actor
  ) {
    return { ok: false, error: "forbidden" };
  }

  const context = await loadCompanyContextForLayout();
  const companies = context.companies.map((company) => ({
    id: company.id,
    displayName: company.displayName,
  }));

  const store = new PrismaComplianceReportStore();
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

export async function loadComplianceReportForUi(
  query: ComplianceReportQuery,
): Promise<
  { ok: true; data: ComplianceReportPayload } | { ok: false; status: number; error: string }
> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await getComplianceReport(actor, query);
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error };
  }
  return { ok: true, data: result.data };
}

export async function loadMonthlyBrandMatrixOptions(
  preferredCompanyId?: string,
): Promise<{ ok: true; data: MonthlyBrandMatrixUiOptions } | { ok: false; error: string }> {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "report.view").allowed || !actor) {
    return { ok: false, error: "forbidden" };
  }

  const context = await loadCompanyContextForLayout();
  const companies = context.companies.map((company) => ({
    id: company.id,
    displayName: company.displayName,
  }));

  const store = new PrismaMonthlyBrandMatrixStore();
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

export async function loadMonthlyBrandMatrixForUi(
  query: MonthlyBrandMatrixQuery,
): Promise<
  { ok: true; data: MonthlyBrandMatrixPayload } | { ok: false; status: number; error: string }
> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await getMonthlyBrandMatrix(actor, query);
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error };
  }
  return { ok: true, data: result.data };
}

export async function loadReportingGroupRollupOptions(
  preferredCompanyId?: string,
): Promise<{ ok: true; data: ReportingGroupRollupUiOptions } | { ok: false; error: string }> {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "report.view").allowed || !actor) {
    return { ok: false, error: "forbidden" };
  }

  const context = await loadCompanyContextForLayout();
  const companies = context.companies.map((company) => ({
    id: company.id,
    displayName: company.displayName,
  }));

  const store = new PrismaReportingGroupRollupStore();
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

export async function loadReportingGroupRollupsForUi(
  query: ReportingGroupRollupQuery,
): Promise<
  { ok: true; data: ReportingGroupRollupPayload } | { ok: false; status: number; error: string }
> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await getReportingGroupRollups(actor, query);
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error };
  }
  return { ok: true, data: result.data };
}
