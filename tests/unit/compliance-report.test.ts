import { describe, expect, it } from "vitest";

import { APP_NAV_GROUPS, filterNavGroups } from "@/components/layout/nav-config";
import { authorizePermission } from "@/domain/authz/authorize";
import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { authorizeCompanyAccess } from "@/domain/authz/company-access";
import { roleHasPermission } from "@/domain/authz/matrix";
import {
  assignComplianceAgingBucket,
  buildComplianceReport,
  isCompliancePendingStatus,
} from "@/domain/reporting/compliance-report";
import { parseComplianceReportSearchParams } from "@/domain/reporting/schema";
import {
  COMPLIANCE_REPORT_FORBIDDEN,
  type ComplianceReportSourceNote,
  type ComplianceReportSourceSubject,
} from "@/domain/reporting/types";
import { getComplianceReport } from "@/server/reporting/compliance-report-service";

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

function subject(
  overrides: Partial<ComplianceReportSourceSubject> = {},
): ComplianceReportSourceSubject {
  return {
    subjectType: "INVOICE",
    subjectId: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiiii",
    companyId: COMPANY_A,
    complianceStatus: "NOT_REVIEWED",
    date: new Date("2026-01-01T00:00:00.000Z"),
    label: "INV-1",
    ...overrides,
  };
}

function note(overrides: Partial<ComplianceReportSourceNote> = {}): ComplianceReportSourceNote {
  return {
    id: "rrrrrrrr-rrrr-4rrr-8rrr-rrrrrrrrrrrr",
    companyId: COMPANY_A,
    subjectType: "INVOICE",
    subjectId: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiiii",
    status: "FLAGGED",
    notes: "Needs docs",
    reason: "KYC",
    resolutionNotes: null,
    evidenceRefs: ["ev-1"],
    reviewerUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    createdAt: new Date("2026-01-10T00:00:00.000Z"),
    label: "INV-1",
    ...overrides,
  };
}

describe("compliance report aggregation (TASK-087)", () => {
  it("counts approved, flagged, and pending (not reviewed + under review)", () => {
    const report = buildComplianceReport(
      [
        subject({ complianceStatus: "NOT_REVIEWED" }),
        subject({
          subjectId: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiii2",
          complianceStatus: "UNDER_REVIEW",
        }),
        subject({
          subjectId: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiii3",
          complianceStatus: "APPROVED",
        }),
        subject({
          subjectId: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiii4",
          complianceStatus: "FLAGGED",
        }),
        subject({
          subjectType: "PAYMENT",
          subjectId: "pppppppp-pppp-4ppp-8ppp-pppppppppppp",
          complianceStatus: "NOT_REVIEWED",
        }),
      ],
      [],
      { asOf: new Date("2026-01-15T00:00:00.000Z") },
    );

    expect(isCompliancePendingStatus("NOT_REVIEWED")).toBe(true);
    expect(isCompliancePendingStatus("UNDER_REVIEW")).toBe(true);
    expect(isCompliancePendingStatus("APPROVED")).toBe(false);

    expect(report.statusCounts).toMatchObject({
      notReviewed: 2,
      underReview: 1,
      approved: 1,
      flagged: 1,
      pending: 3,
      total: 5,
    });

    const invoice = report.bySubjectType.find((row) => row.subjectType === "INVOICE");
    expect(invoice).toMatchObject({ pending: 2, approved: 1, flagged: 1, total: 4 });
    const payment = report.bySubjectType.find((row) => row.subjectType === "PAYMENT");
    expect(payment).toMatchObject({ pending: 1, total: 1 });
  });

  it("ages pending and flagged subjects into buckets", () => {
    expect(assignComplianceAgingBucket(0)).toBe("0-30");
    expect(assignComplianceAgingBucket(30)).toBe("0-30");
    expect(assignComplianceAgingBucket(31)).toBe("31-60");
    expect(assignComplianceAgingBucket(90)).toBe("61-90");
    expect(assignComplianceAgingBucket(91)).toBe("90+");
    expect(assignComplianceAgingBucket(-1)).toBeNull();

    const asOf = new Date("2026-04-01T00:00:00.000Z");
    const report = buildComplianceReport(
      [
        subject({
          complianceStatus: "NOT_REVIEWED",
          date: new Date("2026-03-20T00:00:00.000Z"),
        }),
        subject({
          subjectId: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiii2",
          complianceStatus: "FLAGGED",
          date: new Date("2026-02-01T00:00:00.000Z"),
        }),
        subject({
          subjectId: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiii3",
          complianceStatus: "UNDER_REVIEW",
          date: new Date("2025-12-01T00:00:00.000Z"),
        }),
        subject({
          subjectId: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiii4",
          complianceStatus: "APPROVED",
          date: new Date("2025-01-01T00:00:00.000Z"),
        }),
      ],
      [],
      { asOf },
    );

    const bucket0 = report.aging.find((row) => row.bucket === "0-30");
    const bucket31 = report.aging.find((row) => row.bucket === "31-60");
    const bucket90 = report.aging.find((row) => row.bucket === "90+");
    expect(bucket0).toMatchObject({ pendingCount: 1, flaggedCount: 0 });
    expect(bucket31).toMatchObject({ pendingCount: 0, flaggedCount: 1 });
    expect(bucket90).toMatchObject({ pendingCount: 1, flaggedCount: 0 });
  });

  it("includes notes references for note-bearing reviews only", () => {
    const report = buildComplianceReport(
      [subject({ complianceStatus: "FLAGGED" })],
      [
        note(),
        note({
          id: "rrrrrrrr-rrrr-4rrr-8rrr-rrrrrrrrrrr2",
          notes: null,
          reason: null,
          resolutionNotes: null,
          evidenceRefs: null,
        }),
        note({
          id: "rrrrrrrr-rrrr-4rrr-8rrr-rrrrrrrrrrr3",
          notes: null,
          reason: null,
          resolutionNotes: "Closed",
          evidenceRefs: null,
          createdAt: new Date("2026-01-12T00:00:00.000Z"),
        }),
      ],
    );

    expect(report.noteReferenceTotal).toBe(2);
    expect(report.noteReferences).toHaveLength(2);
    expect(report.noteReferences[0]?.reviewId).toBe("rrrrrrrr-rrrr-4rrr-8rrr-rrrrrrrrrrr3");
    expect(report.noteReferences[0]?.hasResolutionNotes).toBe(true);
    expect(report.noteReferences[1]?.hasNotes).toBe(true);
    expect(report.noteReferences[1]?.evidenceRefCount).toBe(1);
  });
});

describe("compliance report UI authorization / scope (TASK-087)", () => {
  it("grants Admin/Compliance and denies Staff for compliance.review", () => {
    expect(roleHasPermission("ADMIN", "compliance.review")).toBe(true);
    expect(roleHasPermission("COMPLIANCE", "compliance.review")).toBe(true);
    expect(roleHasPermission("STAFF", "compliance.review")).toBe(false);

    expect(roleHasPermission("STAFF", "report.view")).toBe(true);

    expect(authorizePermission(principal("ADMIN"), "compliance.review").allowed).toBe(true);
    expect(authorizePermission(principal("COMPLIANCE"), "compliance.review").allowed).toBe(true);
    expect(authorizePermission(principal("STAFF"), "compliance.review").allowed).toBe(false);
  });

  it("shows Compliance report nav when compliance.review is allowed", () => {
    const item = APP_NAV_GROUPS.flatMap((group) => group.items).find(
      (entry) => entry.href === "/reports/compliance",
    );
    expect(item?.label).toBe("Compliance report");
    expect(item?.permissions).toEqual(["compliance.review"]);

    const staffAllowed = new Set<string>(["/", "/reports/currencies"]);
    const staffGroups = filterNavGroups(staffAllowed);
    expect(
      staffGroups
        .flatMap((group) => group.items)
        .some((entry) => entry.href === "/reports/compliance"),
    ).toBe(false);

    const reviewerAllowed = new Set<string>(["/", "/reports/compliance"]);
    const reviewerGroups = filterNavGroups(reviewerAllowed);
    expect(
      reviewerGroups
        .flatMap((group) => group.items)
        .some((entry) => entry.href === "/reports/compliance"),
    ).toBe(true);
  });

  it("denies Staff even when report.view is granted", async () => {
    const staff = principal("STAFF", [COMPANY_A]);
    expect(authorizePermission(staff, "report.view").allowed).toBe(true);

    const result = await getComplianceReport(
      staff,
      { companyId: COMPANY_A },
      {
        store: {
          listCompanyIdsInReportingGroup: async () => [],
          listSubjects: async () => [],
          listNoteReferences: async () => [],
        },
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toBe(COMPLIANCE_REPORT_FORBIDDEN);
    }
  });

  it("allows Admin and Compliance and scopes Compliance to assigned companies", async () => {
    const emptyStore = {
      listCompanyIdsInReportingGroup: async () => [],
      listSubjects: async () => [subject()],
      listNoteReferences: async () => [note()],
    };

    const adminResult = await getComplianceReport(principal("ADMIN"), {}, { store: emptyStore });
    expect(adminResult.ok).toBe(true);
    if (adminResult.ok) {
      expect(adminResult.data.statusCounts.total).toBe(1);
      expect(adminResult.data.noteReferenceTotal).toBe(1);
    }

    const compliance = principal("COMPLIANCE", [COMPANY_A]);
    expect(authorizeCompanyAccess(compliance, COMPANY_A).allowed).toBe(true);
    expect(authorizeCompanyAccess(compliance, COMPANY_B).allowed).toBe(false);

    const denied = await getComplianceReport(
      compliance,
      { companyId: COMPANY_B },
      { store: emptyStore },
    );
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.status).toBe(403);
      expect(denied.error).toBe(COMPLIANCE_REPORT_FORBIDDEN);
    }

    const allowed = await getComplianceReport(
      compliance,
      { companyId: COMPANY_A },
      { store: emptyStore },
    );
    expect(allowed.ok).toBe(true);
  });

  it("parses search params for compliance report filters", () => {
    const parsed = parseComplianceReportSearchParams({
      companyId: COMPANY_A,
      currency: "usd",
      status: "FLAGGED",
      subjectType: "PAYMENT",
      gateway: "STRIPE",
    });
    expect(parsed.companyId).toBe(COMPANY_A);
    expect(parsed.currency).toBe("USD");
    expect(parsed.status).toBe("FLAGGED");
    expect(parsed.subjectType).toBe("PAYMENT");
    expect(parsed.gateway).toBe("STRIPE");
  });
});
