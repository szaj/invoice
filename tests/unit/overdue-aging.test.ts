import { describe, expect, it } from "vitest";

import { APP_NAV_GROUPS, filterNavGroups } from "@/components/layout/nav-config";
import { authorizePermission } from "@/domain/authz/authorize";
import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { authorizeCompanyAccess } from "@/domain/authz/company-access";
import { roleHasPermission } from "@/domain/authz/matrix";
import {
  assignOverdueAgingBucket,
  buildOverdueAgingReport,
  isOverdueAgingEligible,
} from "@/domain/reporting/overdue-aging";
import { parseOverdueAgingSearchParams } from "@/domain/reporting/schema";
import { OVERDUE_AGING_FORBIDDEN, type OverdueAgingSourceInvoice } from "@/domain/reporting/types";
import { getOverdueAgingReport } from "@/server/reporting/overdue-aging-service";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";

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
  overrides: Partial<OverdueAgingSourceInvoice> = {},
): OverdueAgingSourceInvoice {
  return {
    status: "OVERDUE",
    dueDate: new Date("2026-08-01T00:00:00.000Z"),
    outstandingAmount: "100.00",
    currencyCode: "USD",
    decimalPrecision: 2,
    ...overrides,
  };
}

describe("overdue aging buckets (TASK-081)", () => {
  it("assigns 1-30, 31-60, 61-90, and 90+ boundaries", () => {
    expect(assignOverdueAgingBucket(0)).toBeNull();
    expect(assignOverdueAgingBucket(-1)).toBeNull();
    expect(assignOverdueAgingBucket(1)).toBe("1-30");
    expect(assignOverdueAgingBucket(30)).toBe("1-30");
    expect(assignOverdueAgingBucket(31)).toBe("31-60");
    expect(assignOverdueAgingBucket(60)).toBe("31-60");
    expect(assignOverdueAgingBucket(61)).toBe("61-90");
    expect(assignOverdueAgingBucket(90)).toBe("61-90");
    expect(assignOverdueAgingBucket(91)).toBe("90+");
    expect(assignOverdueAgingBucket(365)).toBe("90+");
  });

  it("aggregates overdue invoices into buckets by currency", () => {
    const asOf = new Date("2026-08-27T12:00:00.000Z");
    const report = buildOverdueAgingReport(
      [
        // age 26 → 1-30
        sourceInvoice({
          dueDate: new Date("2026-08-01T00:00:00.000Z"),
          outstandingAmount: "50.00",
          currencyCode: "USD",
        }),
        // age 45 → 31-60
        sourceInvoice({
          dueDate: new Date("2026-07-13T00:00:00.000Z"),
          outstandingAmount: "75.00",
          currencyCode: "USD",
        }),
        // age 75 → 61-90
        sourceInvoice({
          dueDate: new Date("2026-06-13T00:00:00.000Z"),
          outstandingAmount: "20.00",
          currencyCode: "EUR",
          decimalPrecision: 2,
        }),
        // age 100 → 90+
        sourceInvoice({
          dueDate: new Date("2026-05-19T00:00:00.000Z"),
          outstandingAmount: "200.00",
          currencyCode: "USD",
        }),
        // same-day due → not overdue
        sourceInvoice({
          dueDate: new Date("2026-08-27T00:00:00.000Z"),
          outstandingAmount: "999.00",
        }),
      ],
      asOf,
    );

    expect(report.asOf).toBe("2026-08-27");
    const byId = new Map(report.buckets.map((b) => [b.bucket, b]));

    expect(byId.get("1-30")?.invoiceCount).toBe(1);
    expect(byId.get("1-30")?.currencies).toEqual([
      {
        currencyCode: "USD",
        outstandingAmount: "50",
        invoiceCount: 1,
        decimalPrecision: 2,
      },
    ]);

    expect(byId.get("31-60")?.invoiceCount).toBe(1);
    expect(byId.get("31-60")?.currencies[0]?.outstandingAmount).toBe("75");

    expect(byId.get("61-90")?.invoiceCount).toBe(1);
    expect(byId.get("61-90")?.currencies[0]?.currencyCode).toBe("EUR");
    expect(byId.get("61-90")?.currencies[0]?.outstandingAmount).toBe("20");

    expect(byId.get("90+")?.invoiceCount).toBe(1);
    expect(byId.get("90+")?.currencies[0]?.outstandingAmount).toBe("200");
  });

  it("excludes draft, paid, and cancelled from aging (BR-018)", () => {
    const asOf = new Date("2026-08-27T12:00:00.000Z");
    expect(
      isOverdueAgingEligible(
        {
          status: "DRAFT",
          dueDate: new Date("2026-01-01T00:00:00.000Z"),
          outstandingAmount: "100.00",
        },
        asOf,
      ),
    ).toBe(false);
    expect(
      isOverdueAgingEligible(
        {
          status: "PAID",
          dueDate: new Date("2026-01-01T00:00:00.000Z"),
          outstandingAmount: "0.00",
        },
        asOf,
      ),
    ).toBe(false);
    expect(
      isOverdueAgingEligible(
        {
          status: "CANCELLED",
          dueDate: new Date("2026-01-01T00:00:00.000Z"),
          outstandingAmount: "100.00",
        },
        asOf,
      ),
    ).toBe(false);
    expect(
      isOverdueAgingEligible(
        {
          status: "ISSUED",
          dueDate: new Date("2026-01-01T00:00:00.000Z"),
          outstandingAmount: "100.00",
        },
        asOf,
      ),
    ).toBe(true);

    const report = buildOverdueAgingReport(
      [
        sourceInvoice({ status: "DRAFT", outstandingAmount: "100.00" }),
        sourceInvoice({ status: "PAID", outstandingAmount: "0.00" }),
        sourceInvoice({ status: "CANCELLED", outstandingAmount: "100.00" }),
      ],
      asOf,
    );
    expect(report.buckets.every((bucket) => bucket.invoiceCount === 0)).toBe(true);
  });
});

describe("overdue aging UI authorization (TASK-081)", () => {
  it("grants report.view to Admin, Compliance, and Staff", () => {
    expect(roleHasPermission("ADMIN", "report.view")).toBe(true);
    expect(roleHasPermission("COMPLIANCE", "report.view")).toBe(true);
    expect(roleHasPermission("STAFF", "report.view")).toBe(true);

    expect(authorizePermission(principal("ADMIN"), "report.view").allowed).toBe(true);
    expect(authorizePermission(principal("COMPLIANCE"), "report.view").allowed).toBe(true);
    expect(authorizePermission(principal("STAFF"), "report.view").allowed).toBe(true);
  });

  it("shows Overdue aging nav when report.view is allowed", () => {
    const item = APP_NAV_GROUPS.flatMap((group) => group.items).find(
      (entry) => entry.href === "/reports/overdue-aging",
    );
    expect(item?.label).toBe("Overdue aging");
    expect(item?.permissions).toEqual(["report.view"]);

    const allowed = new Set<string>(["/reports/overdue-aging"]);
    const groups = filterNavGroups(allowed);
    expect(
      groups
        .flatMap((group) => group.items)
        .some((entry) => entry.href === "/reports/overdue-aging"),
    ).toBe(true);
  });

  it("scopes Staff to assigned companies and denies unassigned company filter", async () => {
    const staff = principal("STAFF", [COMPANY_A]);
    expect(authorizeCompanyAccess(staff, COMPANY_A).allowed).toBe(true);
    expect(authorizeCompanyAccess(staff, COMPANY_B).allowed).toBe(false);

    const result = await getOverdueAgingReport(
      staff,
      { companyId: COMPANY_B },
      {
        store: {
          listCompanyIdsInReportingGroup: async () => [],
          listOverdueAgingInvoices: async () => [],
        },
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toBe(OVERDUE_AGING_FORBIDDEN);
    }
  });

  it("passes visibleToStaffUserId for Staff report loads", async () => {
    const staff = principal("STAFF", [COMPANY_A]);
    let seenVisible: string | null | undefined;
    const asOf = new Date("2026-08-27T12:00:00.000Z");
    const result = await getOverdueAgingReport(
      staff,
      { companyId: COMPANY_A },
      {
        now: () => asOf,
        store: {
          listCompanyIdsInReportingGroup: async () => [],
          listOverdueAgingInvoices: async (filters) => {
            seenVisible = filters.visibleToStaffUserId;
            return [
              sourceInvoice({
                dueDate: new Date("2026-08-01T00:00:00.000Z"),
                outstandingAmount: "10.00",
              }),
            ];
          },
        },
      },
    );
    expect(result.ok).toBe(true);
    expect(seenVisible).toBe(staff.userId);
    if (result.ok) {
      expect(result.data.buckets.find((b) => b.bucket === "1-30")?.invoiceCount).toBe(1);
    }
  });

  it("parses search params for overdue aging filters", () => {
    const parsed = parseOverdueAgingSearchParams({
      companyId: COMPANY_A,
      invoiceCurrency: "usd",
      complianceStatus: "FLAGGED",
    });
    expect(parsed.companyId).toBe(COMPANY_A);
    expect(parsed.invoiceCurrency).toBe("USD");
    expect(parsed.complianceStatus).toBe("FLAGGED");
  });
});
