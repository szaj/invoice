import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { createCompany } from "@/server/companies/company-service";
import { PrismaCompanyStore } from "@/server/companies/company-repository";
import { EmailService } from "@/server/email/email-service";
import { MemoryEmailProvider } from "@/server/email/memory-email-provider";
import { OperationalNotificationService } from "@/server/notifications/notification-service";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("operational notifications integration (TASK-091)", () => {
  const createdCompanyIds: string[] = [];
  const createdUserIds: string[] = [];

  afterAll(async () => {
    if (!runDbIntegration) {
      return;
    }
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    if (createdCompanyIds.length > 0) {
      await prisma.userCompany.deleteMany({ where: { companyId: { in: createdCompanyIds } } });
      await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.userCompany.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  it("delivers flagged compliance alerts to Admin and assigned Compliance users", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const memoryEmail = new MemoryEmailProvider();
    const service = new OperationalNotificationService({
      emailService: new EmailService(memoryEmail, "noreply@localhost.test"),
    });

    const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: "ADMIN" } });
    const complianceRole = await prisma.role.findUniqueOrThrow({ where: { code: "COMPLIANCE" } });

    const adminId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee81";
    const complianceId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee82";

    await prisma.user.deleteMany({ where: { id: { in: [adminId, complianceId] } } });

    const adminEmail = `task091-admin-${Date.now()}@example.com`;
    const complianceEmail = `task091-compliance-${Date.now()}@example.com`;

    await prisma.user.createMany({
      data: [
        {
          id: adminId,
          name: "TASK-091 Admin",
          email: adminEmail,
          supabaseAuthUserId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee83",
          status: "ACTIVE",
          roleId: adminRole.id,
        },
        {
          id: complianceId,
          name: "TASK-091 Compliance",
          email: complianceEmail,
          supabaseAuthUserId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee84",
          status: "ACTIVE",
          roleId: complianceRole.id,
        },
      ],
    });
    createdUserIds.push(adminId, complianceId);

    const admin: AuthorizationPrincipal = {
      userId: adminId,
      status: "ACTIVE",
      roleCode: "ADMIN",
    };

    const company = await createCompany(
      admin,
      { displayName: `Notify Co ${Date.now()}` },
      { store: new PrismaCompanyStore() },
    );
    expect(company.ok).toBe(true);
    if (!company.ok) {
      throw new Error("company create failed");
    }
    createdCompanyIds.push(company.data.id);

    await prisma.userCompany.create({
      data: { userId: complianceId, companyId: company.data.id },
    });

    await service.emit({
      kind: "COMPLIANCE_FLAGGED",
      companyId: company.data.id,
      subjectType: "INVOICE",
      subjectId: "33333333-3333-4333-8333-333333333333",
      subjectLabel: "INV-100",
      status: "FLAGGED",
      reason: "SUSPICIOUS_AMOUNT",
      notes: "Needs review",
    });

    expect(memoryEmail.sent.map((row) => row.to)).toEqual(
      expect.arrayContaining([adminEmail, complianceEmail]),
    );
    expect(memoryEmail.sent.every((row) => row.subject.includes("Compliance flagged"))).toBe(true);
  }, 120_000);

  it("records the operational_notification_settings migration when applied", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM _prisma_migrations
      WHERE migration_name = '20260828090000_operational_notification_settings'
    `;
    expect(rows).toHaveLength(1);
  });
});
