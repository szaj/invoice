import "server-only";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import {
  buildCompanyPerformanceExport,
  buildComplianceReportExport,
  buildCurrencyReportExport,
  buildCustomerReportExport,
  buildGatewayReportExport,
  buildInvoiceReportExport,
  buildMonthlyBrandMatrixExport,
  buildOutstandingReportExport,
  buildOverdueAgingReportExport,
  buildPaymentReportExport,
  buildReportingGroupRollupExport,
  buildStaffPerformanceExport,
} from "@/domain/reporting/export/builders";
import type { ReportExportBuildResult, ReportExportType } from "@/domain/reporting/export/types";
import { REPORT_EXPORT_MAX_ROWS } from "@/domain/reporting/export/types";
import {
  COMPANY_PERFORMANCE_MAX_PAGE_SIZE,
  CUSTOMER_REPORT_MAX_PAGE_SIZE,
  GATEWAY_REPORT_MAX_PAGE_SIZE,
  INVOICE_REPORT_MAX_PAGE_SIZE,
  OUTSTANDING_REPORT_MAX_PAGE_SIZE,
  PAYMENT_REPORT_MAX_PAGE_SIZE,
  STAFF_PERFORMANCE_MAX_PAGE_SIZE,
} from "@/domain/reporting/types";
import { getCompanyPerformance } from "@/server/reporting/company-performance-service";
import { getComplianceReport } from "@/server/reporting/compliance-report-service";
import { getCurrencyReport } from "@/server/reporting/currency-report-service";
import { getCustomerReport } from "@/server/reporting/customer-report-service";
import { getGatewayReport } from "@/server/reporting/gateway-report-service";
import { getInvoiceReport } from "@/server/reporting/invoice-report-service";
import { getMonthlyBrandMatrix } from "@/server/reporting/monthly-brand-matrix-service";
import { getOutstandingReport } from "@/server/reporting/outstanding-report-service";
import { getOverdueAgingReport } from "@/server/reporting/overdue-aging-service";
import { getPaymentReport } from "@/server/reporting/payment-report-service";
import { getReportingGroupRollups } from "@/server/reporting/reporting-group-rollup-service";
import { getStaffPerformance } from "@/server/reporting/staff-performance-service";

export type ReportExportDataResult =
  | { ok: true; data: ReportExportBuildResult }
  | { ok: false; status: 400 | 401 | 403 | 503; error: string };

function mapServiceError(result: {
  ok: false;
  status: 400 | 401 | 403 | 503;
  error: string;
}): ReportExportDataResult {
  return result;
}

async function fetchAllPages<TRow>(
  fetchPage: (
    page: number,
    pageSize: number,
  ) => Promise<
    | { ok: true; data: { rows: readonly TRow[]; totalCount: number } }
    | { ok: false; status: 400 | 401 | 403 | 503; error: string }
  >,
  pageSize: number,
): Promise<
  | { ok: true; data: { rows: TRow[]; totalCount: number } }
  | { ok: false; status: 400 | 401 | 403 | 503; error: string }
> {
  const rows: TRow[] = [];
  let totalCount = 0;
  let page = 1;
  while (rows.length < REPORT_EXPORT_MAX_ROWS) {
    const result = await fetchPage(page, pageSize);
    if (!result.ok) {
      return result;
    }
    rows.push(...result.data.rows);
    totalCount = result.data.totalCount;
    if (rows.length >= totalCount || result.data.rows.length === 0) {
      break;
    }
    page += 1;
  }
  return { ok: true, data: { rows, totalCount } };
}

export async function loadReportExportData(
  actor: AuthorizationPrincipal,
  reportType: ReportExportType,
  filters: Record<string, unknown>,
): Promise<ReportExportDataResult> {
  switch (reportType) {
    case "invoices": {
      const paged = await fetchAllPages(
        (page, pageSize) => getInvoiceReport(actor, { ...filters, page, pageSize }),
        INVOICE_REPORT_MAX_PAGE_SIZE,
      );
      if (!paged.ok) {
        return paged;
      }
      const report = await getInvoiceReport(actor, {
        ...filters,
        page: 1,
        pageSize: INVOICE_REPORT_MAX_PAGE_SIZE,
      });
      if (!report.ok) {
        return mapServiceError(report);
      }
      return {
        ok: true,
        data: buildInvoiceReportExport({
          ...report.data,
          rows: paged.data.rows,
          totalCount: paged.data.totalCount,
        }),
      };
    }
    case "payments": {
      const paged = await fetchAllPages(
        (page, pageSize) => getPaymentReport(actor, { ...filters, page, pageSize }),
        PAYMENT_REPORT_MAX_PAGE_SIZE,
      );
      if (!paged.ok) {
        return paged;
      }
      const report = await getPaymentReport(actor, {
        ...filters,
        page: 1,
        pageSize: PAYMENT_REPORT_MAX_PAGE_SIZE,
      });
      if (!report.ok) {
        return mapServiceError(report);
      }
      return {
        ok: true,
        data: buildPaymentReportExport({
          ...report.data,
          rows: paged.data.rows,
          totalCount: paged.data.totalCount,
        }),
      };
    }
    case "outstanding": {
      const paged = await fetchAllPages(
        (page, pageSize) => getOutstandingReport(actor, { ...filters, page, pageSize }),
        OUTSTANDING_REPORT_MAX_PAGE_SIZE,
      );
      if (!paged.ok) {
        return paged;
      }
      const report = await getOutstandingReport(actor, {
        ...filters,
        page: 1,
        pageSize: OUTSTANDING_REPORT_MAX_PAGE_SIZE,
      });
      if (!report.ok) {
        return mapServiceError(report);
      }
      return {
        ok: true,
        data: buildOutstandingReportExport({
          ...report.data,
          rows: paged.data.rows,
          totalCount: paged.data.totalCount,
        }),
      };
    }
    case "overdue-aging": {
      const report = await getOverdueAgingReport(actor, filters);
      if (!report.ok) {
        return mapServiceError(report);
      }
      return { ok: true, data: buildOverdueAgingReportExport(report.data) };
    }
    case "customers": {
      const paged = await fetchAllPages(
        (page, pageSize) => getCustomerReport(actor, { ...filters, page, pageSize }),
        CUSTOMER_REPORT_MAX_PAGE_SIZE,
      );
      if (!paged.ok) {
        return paged;
      }
      const report = await getCustomerReport(actor, {
        ...filters,
        page: 1,
        pageSize: CUSTOMER_REPORT_MAX_PAGE_SIZE,
      });
      if (!report.ok) {
        return mapServiceError(report);
      }
      return {
        ok: true,
        data: buildCustomerReportExport({
          ...report.data,
          rows: paged.data.rows,
          totalCount: paged.data.totalCount,
        }),
      };
    }
    case "companies": {
      const paged = await fetchAllPages(
        (page, pageSize) => getCompanyPerformance(actor, { ...filters, page, pageSize }),
        COMPANY_PERFORMANCE_MAX_PAGE_SIZE,
      );
      if (!paged.ok) {
        return paged;
      }
      const report = await getCompanyPerformance(actor, {
        ...filters,
        page: 1,
        pageSize: COMPANY_PERFORMANCE_MAX_PAGE_SIZE,
      });
      if (!report.ok) {
        return mapServiceError(report);
      }
      return {
        ok: true,
        data: buildCompanyPerformanceExport({
          ...report.data,
          rows: paged.data.rows,
          totalCount: paged.data.totalCount,
        }),
      };
    }
    case "staff": {
      const paged = await fetchAllPages(
        (page, pageSize) => getStaffPerformance(actor, { ...filters, page, pageSize }),
        STAFF_PERFORMANCE_MAX_PAGE_SIZE,
      );
      if (!paged.ok) {
        return paged;
      }
      const report = await getStaffPerformance(actor, {
        ...filters,
        page: 1,
        pageSize: STAFF_PERFORMANCE_MAX_PAGE_SIZE,
      });
      if (!report.ok) {
        return mapServiceError(report);
      }
      return {
        ok: true,
        data: buildStaffPerformanceExport({
          ...report.data,
          rows: paged.data.rows,
          totalCount: paged.data.totalCount,
        }),
      };
    }
    case "gateways": {
      const paged = await fetchAllPages(
        (page, pageSize) => getGatewayReport(actor, { ...filters, page, pageSize }),
        GATEWAY_REPORT_MAX_PAGE_SIZE,
      );
      if (!paged.ok) {
        return paged;
      }
      const report = await getGatewayReport(actor, {
        ...filters,
        page: 1,
        pageSize: GATEWAY_REPORT_MAX_PAGE_SIZE,
      });
      if (!report.ok) {
        return mapServiceError(report);
      }
      return {
        ok: true,
        data: buildGatewayReportExport({
          ...report.data,
          rows: paged.data.rows,
          totalCount: paged.data.totalCount,
        }),
      };
    }
    case "currencies": {
      const report = await getCurrencyReport(actor, filters);
      if (!report.ok) {
        return mapServiceError(report);
      }
      return { ok: true, data: buildCurrencyReportExport(report.data) };
    }
    case "compliance-report": {
      const report = await getComplianceReport(actor, filters);
      if (!report.ok) {
        return mapServiceError(report);
      }
      return { ok: true, data: buildComplianceReportExport(report.data) };
    }
    case "monthly-brand": {
      const report = await getMonthlyBrandMatrix(actor, filters);
      if (!report.ok) {
        return mapServiceError(report);
      }
      return { ok: true, data: buildMonthlyBrandMatrixExport(report.data) };
    }
    case "reporting-groups": {
      const report = await getReportingGroupRollups(actor, filters);
      if (!report.ok) {
        return mapServiceError(report);
      }
      return { ok: true, data: buildReportingGroupRollupExport(report.data) };
    }
    default:
      return { ok: false, status: 400, error: "Unsupported report type." };
  }
}
