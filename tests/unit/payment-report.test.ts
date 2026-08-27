import { describe, expect, it } from "vitest";

import { APP_NAV_GROUPS, filterNavGroups } from "@/components/layout/nav-config";
import { authorizePermission } from "@/domain/authz/authorize";
import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { authorizeCompanyAccess } from "@/domain/authz/company-access";
import { roleHasPermission } from "@/domain/authz/matrix";
import {
  assertPaymentReportUsesStoredSnapshots,
  paymentReportRowsFromStoredSnapshots,
} from "@/domain/reporting/payment-report";
import { parsePaymentReportSearchParams } from "@/domain/reporting/schema";
import { PAYMENT_REPORT_FORBIDDEN, type PaymentReportRow } from "@/domain/reporting/types";
import { getPaymentReport } from "@/server/reporting/payment-report-service";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const PAYMENT_A = "33333333-3333-4333-8333-333333333333";
const INVOICE_A = "44444444-4444-4444-8444-444444444444";
const CUSTOMER_A = "55555555-5555-4555-8555-555555555555";

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

function storedRow(overrides: Partial<PaymentReportRow> = {}): PaymentReportRow {
  return {
    id: PAYMENT_A,
    invoiceId: INVOICE_A,
    invoiceNumber: "INV-001",
    customerId: CUSTOMER_A,
    customerDisplayName: "Acme",
    methodCode: "MANUAL",
    externalTransactionId: "txn-1",
    invoiceCurrencyCode: "USD",
    invoiceAmountApplied: "100.00",
    fixedConversionRate: "3.672500000000",
    rateSource: "ADMIN_FIXED_RATE",
    settlementCurrencyCode: "AED",
    convertedSettlementAmount: "367.25",
    processorFeeAmount: "2.50",
    actualReceivedAmount: "364.75",
    paymentDate: "2026-08-10",
    status: "SUCCESSFUL",
    invoiceDecimalPrecision: 2,
    settlementDecimalPrecision: 2,
    ...overrides,
  };
}

describe("payment report stored snapshots (TASK-079)", () => {
  it("passes through stored fixed rate and converted settlement without recalculation", () => {
    const stored = storedRow();
    const rows = paymentReportRowsFromStoredSnapshots([stored]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.fixedConversionRate).toBe("3.672500000000");
    expect(rows[0]?.convertedSettlementAmount).toBe("367.25");
    expect(rows[0]?.processorFeeAmount).toBe("2.50");
    expect(rows[0]?.actualReceivedAmount).toBe("364.75");
    // Fee remains a distinct field — not folded into settlement.
    expect(rows[0]?.processorFeeAmount).not.toBe(rows[0]?.convertedSettlementAmount);
  });

  it("rejects rows missing stored snapshot fields", () => {
    expect(() =>
      assertPaymentReportUsesStoredSnapshots([storedRow({ fixedConversionRate: "" })]),
    ).toThrow(/fixed conversion rate/i);
    expect(() =>
      assertPaymentReportUsesStoredSnapshots([storedRow({ convertedSettlementAmount: "   " })]),
    ).toThrow(/converted settlement/i);
  });

  it("service returns store snapshot fields unchanged (no live rate path)", async () => {
    const stored = storedRow({
      fixedConversionRate: "1.250000000000",
      convertedSettlementAmount: "125.00",
      processorFeeAmount: "1.00",
    });
    const result = await getPaymentReport(
      principal("ADMIN"),
      { companyId: COMPANY_A },
      {
        store: {
          listCompanyIdsInReportingGroup: async () => [],
          listPaymentReportPage: async () => ({ rows: [stored], totalCount: 1 }),
        },
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.rows[0]?.fixedConversionRate).toBe("1.250000000000");
    expect(result.data.rows[0]?.convertedSettlementAmount).toBe("125.00");
    expect(result.data.rows[0]?.processorFeeAmount).toBe("1.00");
  });
});

describe("payment report UI authorization (TASK-079)", () => {
  it("grants report.view to Admin, Compliance, and Staff", () => {
    expect(roleHasPermission("ADMIN", "report.view")).toBe(true);
    expect(roleHasPermission("COMPLIANCE", "report.view")).toBe(true);
    expect(roleHasPermission("STAFF", "report.view")).toBe(true);

    expect(authorizePermission(principal("ADMIN"), "report.view").allowed).toBe(true);
    expect(authorizePermission(principal("COMPLIANCE"), "report.view").allowed).toBe(true);
    expect(authorizePermission(principal("STAFF"), "report.view").allowed).toBe(true);
  });

  it("shows Payment report nav when report.view is allowed", () => {
    const item = APP_NAV_GROUPS.flatMap((group) => group.items).find(
      (entry) => entry.href === "/reports/payments",
    );
    expect(item?.label).toBe("Payment report");
    expect(item?.permissions).toEqual(["report.view"]);

    const allowed = new Set<string>(["/reports/payments"]);
    const groups = filterNavGroups(allowed);
    expect(
      groups.flatMap((group) => group.items).some((entry) => entry.href === "/reports/payments"),
    ).toBe(true);
  });

  it("scopes Staff to assigned companies and denies unassigned company filter", async () => {
    const staff = principal("STAFF", [COMPANY_A]);
    expect(authorizeCompanyAccess(staff, COMPANY_A).allowed).toBe(true);
    expect(authorizeCompanyAccess(staff, COMPANY_B).allowed).toBe(false);

    const result = await getPaymentReport(
      staff,
      { companyId: COMPANY_B },
      {
        store: {
          listCompanyIdsInReportingGroup: async () => [],
          listPaymentReportPage: async () => ({ rows: [] as PaymentReportRow[], totalCount: 0 }),
        },
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toBe(PAYMENT_REPORT_FORBIDDEN);
    }
  });

  it("passes visibleToStaffUserId for Staff report loads", async () => {
    const staff = principal("STAFF", [COMPANY_A]);
    let seenVisible: string | null | undefined;
    const result = await getPaymentReport(
      staff,
      { companyId: COMPANY_A },
      {
        store: {
          listCompanyIdsInReportingGroup: async () => [],
          listPaymentReportPage: async (filters) => {
            seenVisible = filters.visibleToStaffUserId;
            return { rows: [], totalCount: 0 };
          },
        },
      },
    );
    expect(result.ok).toBe(true);
    expect(seenVisible).toBe(staff.userId);
  });

  it("does not pass visibleToStaffUserId for Admin or Compliance", async () => {
    for (const role of ["ADMIN", "COMPLIANCE"] as const) {
      let seenVisible: string | null | undefined = "unset";
      const actor = principal(role, [COMPANY_A]);
      const result = await getPaymentReport(
        actor,
        { companyId: COMPANY_A },
        {
          store: {
            listCompanyIdsInReportingGroup: async () => [],
            listPaymentReportPage: async (filters) => {
              seenVisible = filters.visibleToStaffUserId;
              return { rows: [], totalCount: 0 };
            },
          },
        },
      );
      expect(result.ok).toBe(true);
      expect(seenVisible).toBeNull();
    }
  });

  it("parses search params with payment filters/sort and without inventing reporting currency or live rate", () => {
    const query = parsePaymentReportSearchParams({
      companyId: COMPANY_A,
      paymentStatus: "SUCCESSFUL",
      paymentMethod: "STRIPE",
      settlementCurrency: "aed",
      page: "2",
      pageSize: "25",
      sortBy: "settlement",
      sortDir: "asc",
    });
    expect(query).not.toHaveProperty("reportingCurrency");
    expect(query).not.toHaveProperty("liveRate");
    expect(query).not.toHaveProperty("fixedConversionRate");
    expect(query.settlementCurrency).toBe("AED");
    expect(query.paymentStatus).toBe("SUCCESSFUL");
    expect(query.paymentMethod).toBe("STRIPE");
    expect(query.page).toBe(2);
    expect(query.pageSize).toBe(25);
    expect(query.sortBy).toBe("settlement");
    expect(query.sortDir).toBe("asc");
  });
});
