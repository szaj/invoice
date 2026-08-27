import { describe, expect, it, vi } from "vitest";

import { parseAuditViewerSearchParams } from "@/domain/audit/schema";
import {
  AUDIT_INVALID_INPUT,
  AUDIT_READ_FORBIDDEN,
  AuditActions,
  type AuditEventRecord,
} from "@/domain/audit/types";
import { auditEntityHref } from "@/domain/audit/viewer";
import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { formatTimestampInTimeZone } from "@/lib/time";
import { listAuditEvents } from "@/server/audit/audit-query-service";

const assignedCompanyId = "22222222-2222-4222-8222-222222222222";
const otherCompanyId = "33333333-3333-4333-8333-333333333333";
const actorUserId = "11111111-1111-4111-8111-111111111111";

function principal(
  roleCode: "ADMIN" | "COMPLIANCE" | "STAFF",
  assignedCompanyIds: string[] = [assignedCompanyId],
): AuthorizationPrincipal {
  return {
    userId: actorUserId,
    status: "ACTIVE",
    roleCode,
    assignedCompanyIds: roleCode === "ADMIN" ? [] : assignedCompanyIds,
  };
}

function eventRecord(overrides: Partial<AuditEventRecord> = {}): AuditEventRecord {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    occurredAt: new Date("2026-08-27T12:00:00.000Z"),
    actorType: "USER",
    actorUserId,
    companyId: assignedCompanyId,
    entityType: "invoice",
    entityId: "44444444-4444-4444-8444-444444444444",
    action: AuditActions.INVOICE_ISSUED,
    oldValues: { status: "DRAFT" },
    newValues: { status: "ISSUED", password: "should-not-leak" },
    reason: null,
    ipAddress: "203.0.113.10",
    userAgent: "vitest",
    correlationId: "corr-1",
    ...overrides,
  };
}

describe("audit viewer authorization (TASK-076)", () => {
  it("denies Staff with 403 and does not query (US-010)", async () => {
    const list = vi.fn();
    const result = await listAuditEvents(principal("STAFF"), {}, { store: { list } });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toBe(AUDIT_READ_FORBIDDEN);
    }
    expect(list).not.toHaveBeenCalled();
  });

  it("scopes Compliance reads to assigned companies and excludes global events", async () => {
    const list = vi.fn().mockResolvedValue([eventRecord()]);
    const result = await listAuditEvents(principal("COMPLIANCE"), {}, { store: { list } });

    expect(result.ok).toBe(true);
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        companyIds: [assignedCompanyId],
        includeNullCompany: false,
      }),
    );
  });

  it("denies Compliance filter for an unassigned company", async () => {
    const list = vi.fn();
    const result = await listAuditEvents(
      principal("COMPLIANCE"),
      { companyId: otherCompanyId },
      { store: { list } },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toBe(AUDIT_READ_FORBIDDEN);
    }
    expect(list).not.toHaveBeenCalled();
  });

  it("allows Admin all-companies reads including null companyId", async () => {
    const list = vi.fn().mockResolvedValue([
      eventRecord(),
      eventRecord({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        companyId: null,
        action: AuditActions.LOGIN_SUCCEEDED,
      }),
    ]);
    const result = await listAuditEvents(principal("ADMIN"), {}, { store: { list } });

    expect(result.ok).toBe(true);
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ companyIds: "ALL", includeNullCompany: true }),
    );
    if (result.ok) {
      expect(result.data).toHaveLength(2);
    }
  });

  it("returns empty when Compliance has no company assignments", async () => {
    const list = vi.fn();
    const result = await listAuditEvents(principal("COMPLIANCE", []), {}, { store: { list } });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([]);
    }
    expect(list).not.toHaveBeenCalled();
  });

  it("re-masks sensitive values on read", async () => {
    const list = vi.fn().mockResolvedValue([eventRecord()]);
    const result = await listAuditEvents(principal("ADMIN"), {}, { store: { list } });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]?.newValues).toEqual({
        status: "ISSUED",
        password: "[Redacted]",
      });
      expect(JSON.stringify(result.data[0])).not.toMatch(/should-not-leak/);
    }
  });

  it("rejects invalid filter input", async () => {
    const list = vi.fn();
    const result = await listAuditEvents(
      principal("ADMIN"),
      { companyId: "not-a-uuid" },
      { store: { list } },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toBe(AUDIT_INVALID_INPUT);
    }
    expect(list).not.toHaveBeenCalled();
  });
});

describe("audit viewer query parsing", () => {
  it("parses filters and treats date-only dateTo as inclusive end of UTC day", () => {
    const parsed = parseAuditViewerSearchParams({
      companyId: assignedCompanyId,
      actorType: "USER",
      entityType: "invoice",
      action: "invoices.issued",
      dateFrom: "2026-08-01",
      dateTo: "2026-08-27",
    });

    expect(parsed.companyId).toBe(assignedCompanyId);
    expect(parsed.actorType).toBe("USER");
    expect(parsed.entityType).toBe("invoice");
    expect(parsed.action).toBe("invoices.issued");
    expect(parsed.dateFrom?.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(parsed.dateTo?.toISOString()).toBe("2026-08-27T23:59:59.999Z");
  });

  it("returns empty query for invalid search params", () => {
    expect(parseAuditViewerSearchParams({ actorType: "NOPE", companyId: "bad" })).toEqual({});
  });
});

describe("audit viewer display helpers", () => {
  it("links known entity types and leaves others unlinked", () => {
    expect(auditEntityHref("invoice", "44444444-4444-4444-8444-444444444444")).toBe(
      "/invoices/44444444-4444-4444-8444-444444444444",
    );
    expect(auditEntityHref("session", "abc")).toBeNull();
    expect(auditEntityHref("invoice", null)).toBeNull();
  });

  it("formats UTC instants in the system timezone", () => {
    const formatted = formatTimestampInTimeZone(new Date("2026-08-27T12:00:00.000Z"), "UTC");
    expect(formatted).toContain("2026-08-27");
    expect(formatted).toContain("UTC");
  });
});
