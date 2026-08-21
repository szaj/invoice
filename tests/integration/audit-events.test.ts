import { afterAll, describe, expect, it } from "vitest";

import { AuditActions } from "@/domain/audit/types";
import { loginWithPassword } from "@/server/auth/login";
import { MemoryLoginRateLimiter } from "@/server/auth/rate-limit";
import type { PasswordIdentityProvider } from "@/server/auth/login";
import { PrismaUserIdentityStore } from "@/server/auth/identity-repository";
import { getAuditWriter } from "@/server/audit/audit-service";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("audit event foundation integration", () => {
  const createdUserIds: string[] = [];
  const createdAuditIds: string[] = [];

  it("records the audit_event_foundation migrations when applied", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM _prisma_migrations
      WHERE migration_name IN (
        '20260820270000_audit_event_foundation',
        '20260820270100_audit_event_no_fk'
      )
    `;
    expect(rows).toHaveLength(2);
  });

  it("persists an audit_logs row on successful login", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();

    const authUserId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001";
    const email = "audit-login@example.com";

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [{ actorUserId: existing.id }, { entityId: existing.id }],
        },
      });
      await prisma.user.delete({ where: { id: existing.id } });
    }

    const user = await prisma.user.create({
      data: {
        name: "Audit Login",
        email,
        supabaseAuthUserId: authUserId,
        status: "ACTIVE",
      },
    });
    createdUserIds.push(user.id);

    const provider: PasswordIdentityProvider = {
      async signInWithPassword() {
        return { ok: true, identity: { authUserId, email } };
      },
      async signOut() {},
    };

    const result = await loginWithPassword(
      { email, password: "not-used-by-mock" },
      {
        rateLimiter: new MemoryLoginRateLimiter(),
        identityProvider: provider,
        identityStore: new PrismaUserIdentityStore(),
        clientKey: "198.51.100.10",
        userAgent: "integration-test",
        auditWriter: getAuditWriter(),
      },
    );

    expect(result.ok).toBe(true);

    const events = await prisma.auditLog.findMany({
      where: {
        action: AuditActions.LOGIN_SUCCEEDED,
        actorUserId: user.id,
      },
      orderBy: { occurredAt: "desc" },
      take: 1,
    });
    expect(events).toHaveLength(1);
    createdAuditIds.push(events[0]!.id);
    expect(events[0]!.ipAddress).toBe("198.51.100.10");
    expect(events[0]!.userAgent).toBe("integration-test");
    expect(events[0]!.entityType).toBe("session");
    expect(events[0]!.correlationId).toBeTruthy();

    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    const tableNames = tables.map((table) => table.table_name);
    expect(tableNames).toContain("audit_logs");
    expect(tableNames).toContain("invoices");
    expect(tableNames).toContain("payments");
  }, 30_000);

  it("has no application update/delete path for audit rows", async () => {
    const { AppendOnlyAuditWriter } = await import("@/server/audit/audit-service");
    const writer = new AppendOnlyAuditWriter();
    expect(() => writer.update()).toThrow(/append-only/i);
    expect(() => writer.delete()).toThrow(/append-only/i);
  });

  afterAll(async () => {
    if (!runDbIntegration) {
      return;
    }
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    if (createdAuditIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { id: { in: createdAuditIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { actorUserId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });
});
