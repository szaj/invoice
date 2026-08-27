import { describe, expect, it } from "vitest";

import { APP_NAV_GROUPS, filterNavGroups } from "@/components/layout/nav-config";
import { authorizePermission } from "@/domain/authz/authorize";
import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { authorizeCompanyAccess } from "@/domain/authz/company-access";
import { roleHasPermission } from "@/domain/authz/matrix";
import {
  assertCustomerReportHasNoUnlabeledMixedTotal,
  buildCustomerReportRows,
  isCustomerReportEligible,
  paginateCustomerReportRows,
  sortCustomerReportRows,
} from "@/domain/reporting/customer-report";
import { parseCustomerReportSearchParams } from "@/domain/reporting/schema";
import {
  CUSTOMER_REPORT_FORBIDDEN,
  type CustomerReportSourceInvoice,
} from "@/domain/reporting/types";
import { getCustomerReport } from "@/server/reporting/customer-report-service";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const CUSTOMER_1 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CUSTOMER_2 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function principal(
  roleCode: "ADMIN" | "COMPLIANCE" | "STAFF",
  assignedCompanyIds: string[] = [COMPANY_A],
): AuthorizationPrincipal {
  return {
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    status: "ACTIVE",
    roleCode,
    assignedCompanyIds: roleCode === "ADMIN" ? [] : assignedCompanyIds,
  };
}

function sourceInvoice(
  overrides: Partial<CustomerReportSourceInvoice> = {},
): CustomerReportSourceInvoice {
  return {
    customerId: CUSTOMER_1,
    customerDisplayName: "Acme Corp",
    currencyCode: "USD",
    status: "ISSUED",
    invoiceTotal: "100.00",
    confirmedPaidAmount: "40.00",
    outstandingAmount: "60.00",
    decimalPrecision: 2,
    ...overrides,
  };
}

describe("customer report grouping by currency (TASK-082)", () => {
  it("aggregates invoiced/paid/outstanding by customer and currency", () => {
    const rows = buildCustomerReportRows([
      sourceInvoice({
        invoiceTotal: "100.00",
        confirmedPaidAmount: "40.00",
        outstandingAmount: "60.00",
      }),
      sourceInvoice({
        invoiceTotal: "50.00",
        confirmedPaidAmount: "50.00",
        outstandingAmount: "0.00",
      }),
      sourceInvoice({
        customerId: CUSTOMER_1,
        customerDisplayName: "Acme Corp",
        currencyCode: "EUR",
        invoiceTotal: "200.00",
        confirmedPaidAmount: "25.00",
        outstandingAmount: "175.00",
      }),
      sourceInvoice({
        customerId: CUSTOMER_2,
        customerDisplayName: "Beta LLC",
        currencyCode: "USD",
        invoiceTotal: "80.00",
        confirmedPaidAmount: "10.00",
        outstandingAmount: "70.00",
      }),
    ]);

    expect(rows).toHaveLength(3);
    assertCustomerReportHasNoUnlabeledMixedTotal(rows);

    const acmeUsd = rows.find((r) => r.customerId === CUSTOMER_1 && r.currencyCode === "USD");
    expect(acmeUsd).toEqual({
      customerId: CUSTOMER_1,
      customerDisplayName: "Acme Corp",
      currencyCode: "USD",
      totalInvoiced: "150",
      totalPaid: "90",
      outstanding: "60",
      invoiceCount: 2,
      decimalPrecision: 2,
    });

    const acmeEur = rows.find((r) => r.customerId === CUSTOMER_1 && r.currencyCode === "EUR");
    expect(acmeEur?.totalInvoiced).toBe("200");
    expect(acmeEur?.totalPaid).toBe("25");
    expect(acmeEur?.outstanding).toBe("175");
    expect(acmeEur?.invoiceCount).toBe(1);

    const betaUsd = rows.find((r) => r.customerId === CUSTOMER_2 && r.currencyCode === "USD");
    expect(betaUsd?.totalInvoiced).toBe("80");
    expect(betaUsd?.invoiceCount).toBe(1);
  });

  it("keeps mixed currencies as separate rows and never one unlabeled total", () => {
    const rows = buildCustomerReportRows([
      sourceInvoice({
        currencyCode: "usd",
        invoiceTotal: "10.00",
        confirmedPaidAmount: "0",
        outstandingAmount: "10.00",
      }),
      sourceInvoice({
        currencyCode: "AED",
        invoiceTotal: "30.00",
        confirmedPaidAmount: "5.00",
        outstandingAmount: "25.00",
      }),
    ]);

    expect(rows.map((r) => r.currencyCode).sort()).toEqual(["AED", "USD"]);
    expect(rows.every((r) => r.currencyCode.length === 3)).toBe(true);
    // Structure has no grandTotal field — BR-013.
    expect(rows).not.toHaveProperty("grandTotal");
    assertCustomerReportHasNoUnlabeledMixedTotal(rows);
  });

  it("excludes draft and cancelled invoices", () => {
    expect(isCustomerReportEligible({ status: "DRAFT" })).toBe(false);
    expect(isCustomerReportEligible({ status: "CANCELLED" })).toBe(false);
    expect(isCustomerReportEligible({ status: "ISSUED" })).toBe(true);
    expect(isCustomerReportEligible({ status: "PAID" })).toBe(true);

    const rows = buildCustomerReportRows([
      sourceInvoice({ status: "DRAFT", invoiceTotal: "999.00" }),
      sourceInvoice({ status: "CANCELLED", invoiceTotal: "888.00" }),
      sourceInvoice({
        status: "PARTIALLY_PAID",
        invoiceTotal: "12.00",
        confirmedPaidAmount: "2.00",
        outstandingAmount: "10.00",
      }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.totalInvoiced).toBe("12");
  });

  it("sorts and paginates customer × currency rows", () => {
    const aggregated = buildCustomerReportRows([
      sourceInvoice({
        customerId: CUSTOMER_2,
        customerDisplayName: "Beta LLC",
        invoiceTotal: "10.00",
        confirmedPaidAmount: "0",
        outstandingAmount: "10.00",
      }),
      sourceInvoice({
        customerDisplayName: "Acme Corp",
        invoiceTotal: "100.00",
        confirmedPaidAmount: "0",
        outstandingAmount: "100.00",
      }),
      sourceInvoice({
        customerDisplayName: "Acme Corp",
        currencyCode: "EUR",
        invoiceTotal: "50.00",
        confirmedPaidAmount: "0",
        outstandingAmount: "50.00",
      }),
    ]);

    const byCustomer = sortCustomerReportRows(aggregated, "customer", "asc");
    expect(byCustomer[0]?.customerDisplayName).toBe("Acme Corp");
    expect(byCustomer[0]?.currencyCode).toBe("EUR");
    expect(byCustomer.at(-1)?.customerDisplayName).toBe("Beta LLC");

    const byInvoiced = sortCustomerReportRows(aggregated, "invoiced", "desc");
    expect(byInvoiced[0]?.totalInvoiced).toBe("100");

    const page = paginateCustomerReportRows(byCustomer, 1, 2);
    expect(page.totalCount).toBe(3);
    expect(page.rows).toHaveLength(2);
  });
});

describe("customer report UI authorization (TASK-082)", () => {
  it("grants report.view to Admin, Compliance, and Staff", () => {
    expect(roleHasPermission("ADMIN", "report.view")).toBe(true);
    expect(roleHasPermission("COMPLIANCE", "report.view")).toBe(true);
    expect(roleHasPermission("STAFF", "report.view")).toBe(true);

    expect(authorizePermission(principal("ADMIN"), "report.view").allowed).toBe(true);
    expect(authorizePermission(principal("COMPLIANCE"), "report.view").allowed).toBe(true);
    expect(authorizePermission(principal("STAFF"), "report.view").allowed).toBe(true);
  });

  it("shows Customer report nav when report.view is allowed", () => {
    const item = APP_NAV_GROUPS.flatMap((group) => group.items).find(
      (entry) => entry.href === "/reports/customers",
    );
    expect(item?.label).toBe("Customer report");
    expect(item?.permissions).toEqual(["report.view"]);

    const allowed = new Set<string>(["/reports/customers"]);
    const groups = filterNavGroups(allowed);
    expect(
      groups.flatMap((group) => group.items).some((entry) => entry.href === "/reports/customers"),
    ).toBe(true);
  });

  it("scopes Staff to assigned companies and denies unassigned company filter", async () => {
    const staff = principal("STAFF", [COMPANY_A]);
    expect(authorizeCompanyAccess(staff, COMPANY_A).allowed).toBe(true);
    expect(authorizeCompanyAccess(staff, COMPANY_B).allowed).toBe(false);

    const result = await getCustomerReport(
      staff,
      { companyId: COMPANY_B },
      {
        store: {
          listCompanyIdsInReportingGroup: async () => [],
          listCustomerReportInvoices: async () => [],
        },
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toBe(CUSTOMER_REPORT_FORBIDDEN);
    }
  });

  it("passes visibleToStaffUserId for Staff report loads", async () => {
    const staff = principal("STAFF", [COMPANY_A]);
    let seenVisible: string | null | undefined;
    const result = await getCustomerReport(
      staff,
      { companyId: COMPANY_A },
      {
        store: {
          listCompanyIdsInReportingGroup: async () => [],
          listCustomerReportInvoices: async (filters) => {
            seenVisible = filters.visibleToStaffUserId;
            return [sourceInvoice()];
          },
        },
      },
    );
    expect(result.ok).toBe(true);
    expect(seenVisible).toBe(staff.userId);
    if (result.ok) {
      expect(result.data.rows).toHaveLength(1);
      expect(result.data.rows[0]?.currencyCode).toBe("USD");
    }
  });

  it("parses search params for customer report filters", () => {
    const parsed = parseCustomerReportSearchParams({
      companyId: COMPANY_A,
      invoiceCurrency: "usd",
      complianceStatus: "FLAGGED",
      sortBy: "outstanding",
      sortDir: "desc",
    });
    expect(parsed.companyId).toBe(COMPANY_A);
    expect(parsed.invoiceCurrency).toBe("USD");
    expect(parsed.complianceStatus).toBe("FLAGGED");
    expect(parsed.sortBy).toBe("outstanding");
    expect(parsed.sortDir).toBe("desc");
  });
});
