import { afterAll, describe, expect, it } from "vitest";

import { bootstrapAdmin } from "@/domain/ops/bootstrap-admin";
import { PrismaBootstrapAdminStore } from "@/ops/bootstrap-admin-store";
import { getPrisma } from "@/server/db/client";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("bootstrap admin integration", () => {
  const emails = ["bootstrap-admin@example.com", "bootstrap-staff@example.com"] as const;
  const createdIds: string[] = [];

  afterAll(async () => {
    if (!runDbIntegration) {
      return;
    }
    const prisma = getPrisma();
    await prisma.user.deleteMany({ where: { email: { in: [...emails] } } });
    if (createdIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
    }
    await prisma.$disconnect();
  });

  it("assigns ADMIN once, stays idempotent, and refuses non-Admin role replacement", async () => {
    const prisma = getPrisma();
    const store = new PrismaBootstrapAdminStore(prisma);
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: "ADMIN" } });
    const staffRole = await prisma.role.findUniqueOrThrow({ where: { code: "STAFF" } });

    await prisma.user.deleteMany({ where: { email: { in: [...emails] } } });

    const candidate = await prisma.user.create({
      data: {
        name: "Bootstrap Candidate",
        email: emails[0],
        supabaseAuthUserId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
        status: "ACTIVE",
      },
    });
    createdIds.push(candidate.id);

    const assigned = await bootstrapAdmin(emails[0], store);
    expect(assigned.ok).toBe(true);
    if (assigned.ok) {
      expect(assigned.outcome).toBe("assigned");
      expect(assigned.userManageResolved).toBe(true);
    }

    const afterAssign = await prisma.user.findUniqueOrThrow({
      where: { id: candidate.id },
      include: { role: true },
    });
    expect(afterAssign.roleId).toBe(adminRole.id);
    expect(afterAssign.role?.code).toBe("ADMIN");

    const again = await bootstrapAdmin(emails[0], store);
    expect(again.ok).toBe(true);
    if (again.ok) {
      expect(again.outcome).toBe("already_admin");
    }

    const staffUser = await prisma.user.create({
      data: {
        name: "Bootstrap Staff",
        email: emails[1],
        supabaseAuthUserId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
        status: "ACTIVE",
        roleId: staffRole.id,
      },
    });
    createdIds.push(staffUser.id);

    const conflict = await bootstrapAdmin(emails[1], store);
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) {
      expect(conflict.code).toBe("role_conflict");
    }

    const unchanged = await prisma.user.findUniqueOrThrow({ where: { id: staffUser.id } });
    expect(unchanged.roleId).toBe(staffRole.id);
  }, 30_000);
});
