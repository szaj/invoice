import { afterAll, describe, expect, it } from "vitest";

import { AUDIT_READ_FORBIDDEN, AuditActions, type AuditJson } from "@/domain/audit/types";
import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { listAuditEvents } from "@/server/audit/audit-query-service";
import { AppendOnlyAuditWriter } from "@/server/audit/audit-service";

function jsonObject(value: AuditJson): { readonly [key: string]: AuditJson } | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as { readonly [key: string]: AuditJson };
}

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("audit log viewer integration (TASK-076)", () => {
  const createdAuditIds: string[] = [];
  const companyA = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0701";
  const companyB = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0702";
  const actorA = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0703";

  const admin: AuthorizationPrincipal = {
    userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0704",
    status: "ACTIVE",
    roleCode: "ADMIN",
  };
  const compliance: AuthorizationPrincipal = {
    userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0705",
    status: "ACTIVE",
    roleCode: "COMPLIANCE",
    assignedCompanyIds: [companyA],
  };
  const staff: AuthorizationPrincipal = {
    userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0706",
    status: "ACTIVE",
    roleCode: "STAFF",
    assignedCompanyIds: [companyA],
  };

  it("is read-only and role-scopes company reads", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const marker = `task076-${Date.now()}`;
    const entityA = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0710";
    const entityB = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0711";
    const createdAt = new Date();

    const rowA = await prisma.auditLog.create({
      data: {
        occurredAt: createdAt,
        actorType: "USER",
        actorUserId: actorA,
        companyId: companyA,
        entityType: "invoice",
        entityId: entityA,
        action: AuditActions.INVOICE_ISSUED,
        newValues: { marker, password: "plaintext-must-not-return" },
        correlationId: `${marker}-a`,
      },
    });
    const rowB = await prisma.auditLog.create({
      data: {
        occurredAt: createdAt,
        actorType: "USER",
        actorUserId: actorA,
        companyId: companyB,
        entityType: "invoice",
        entityId: entityB,
        action: AuditActions.INVOICE_ISSUED,
        newValues: { marker },
        correlationId: `${marker}-b`,
      },
    });
    const rowLogin = await prisma.auditLog.create({
      data: {
        occurredAt: createdAt,
        actorType: "SYSTEM",
        actorUserId: null,
        companyId: null,
        entityType: "session",
        entityId: actorA,
        action: AuditActions.LOGIN_SUCCEEDED,
        newValues: { marker },
        correlationId: `${marker}-login`,
      },
    });
    createdAuditIds.push(rowA.id, rowB.id, rowLogin.id);

    const writer = new AppendOnlyAuditWriter();
    expect(() => writer.update()).toThrow(/append-only/i);
    expect(() => writer.delete()).toThrow(/append-only/i);

    const adminAll = await listAuditEvents(admin, {
      action: AuditActions.INVOICE_ISSUED,
      dateFrom: new Date(createdAt.getTime() - 5_000),
    });
    expect(adminAll.ok).toBe(true);
    if (!adminAll.ok) {
      throw new Error("admin list failed");
    }
    const adminMarked = adminAll.data.filter(
      (event) => jsonObject(event.newValues)?.marker === marker,
    );
    expect(adminMarked.length).toBeGreaterThanOrEqual(2);

    const adminGlobal = await listAuditEvents(admin, {
      action: AuditActions.LOGIN_SUCCEEDED,
      dateFrom: new Date(createdAt.getTime() - 5_000),
    });
    expect(adminGlobal.ok).toBe(true);
    if (adminGlobal.ok) {
      expect(
        adminGlobal.data.some(
          (event) =>
            event.correlationId === `${marker}-login` &&
            event.companyId === null &&
            event.action === AuditActions.LOGIN_SUCCEEDED,
        ),
      ).toBe(true);
    }

    const complianceList = await listAuditEvents(compliance, {
      dateFrom: new Date(createdAt.getTime() - 5_000),
    });
    expect(complianceList.ok).toBe(true);
    if (!complianceList.ok) {
      throw new Error("compliance list failed");
    }
    const complianceMarked = complianceList.data.filter(
      (event) => jsonObject(event.newValues)?.marker === marker,
    );
    expect(complianceMarked).toHaveLength(1);
    expect(complianceMarked[0]?.companyId).toBe(companyA);
    expect(JSON.stringify(complianceMarked[0])).not.toMatch(/plaintext-must-not-return/);
    expect(jsonObject(complianceMarked[0]?.newValues ?? null)?.password).toBe("[Redacted]");

    const unassigned = await listAuditEvents(compliance, { companyId: companyB });
    expect(unassigned.ok).toBe(false);
    if (!unassigned.ok) {
      expect(unassigned.status).toBe(403);
      expect(unassigned.error).toBe(AUDIT_READ_FORBIDDEN);
    }

    const staffList = await listAuditEvents(staff, {});
    expect(staffList.ok).toBe(false);
    if (!staffList.ok) {
      expect(staffList.status).toBe(403);
      expect(staffList.error).toBe(AUDIT_READ_FORBIDDEN);
    }
  }, 30_000);

  afterAll(async () => {
    if (!runDbIntegration) {
      return;
    }
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    if (createdAuditIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { id: { in: createdAuditIds } } });
    }
    await prisma.$disconnect();
  });
});
