import "server-only";

import { getPrisma } from "@/server/db/client";

export class PrismaNotificationRecipientStore {
  async listActiveAdminEmails(): Promise<string[]> {
    const prisma = getPrisma();
    const rows = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        role: { code: "ADMIN" },
      },
      select: { email: true },
      orderBy: [{ email: "asc" }],
    });
    return rows.map((row) => row.email);
  }

  async listActiveComplianceEmailsForCompany(companyId: string): Promise<string[]> {
    const prisma = getPrisma();
    const rows = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        role: { code: "COMPLIANCE" },
        companies: { some: { companyId } },
      },
      select: { email: true },
      orderBy: [{ email: "asc" }],
    });
    return rows.map((row) => row.email);
  }

  async getActiveUserEmail(userId: string): Promise<string | null> {
    const prisma = getPrisma();
    const row = await prisma.user.findFirst({
      where: { id: userId, status: "ACTIVE" },
      select: { email: true },
    });
    return row?.email ?? null;
  }

  async isUserAssignedToCompany(userId: string, companyId: string): Promise<boolean> {
    const prisma = getPrisma();
    const row = await prisma.userCompany.findUnique({
      where: { userId_companyId: { userId, companyId } },
      select: { userId: true },
    });
    return row != null;
  }
}
