import "server-only";

import type { PaymentMethodCode } from "@/domain/settlement/types";
import { getPrisma } from "@/server/db/client";

export type CompanySummary = {
  readonly id: string;
  readonly displayName: string;
};

export type WebhookFailureSummary = {
  readonly count: number;
  readonly lastFailureAt: Date | null;
};

export class PrismaMonitoringStore {
  async listActiveCompanies(): Promise<CompanySummary[]> {
    const prisma = getPrisma();
    return prisma.company.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    });
  }

  async countRecentWebhookFailures(input: {
    readonly companyId: string;
    readonly methodCode: PaymentMethodCode;
    readonly since: Date;
  }): Promise<WebhookFailureSummary> {
    const prisma = getPrisma();
    const where = {
      companyId: input.companyId,
      methodCode: input.methodCode,
      processingStatus: "FAILED" as const,
      createdAt: { gte: input.since },
    };

    const [count, last] = await Promise.all([
      prisma.paymentEvent.count({ where }),
      prisma.paymentEvent.findFirst({
        where,
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    return {
      count,
      lastFailureAt: last?.createdAt ?? null,
    };
  }

  async pingDatabase(): Promise<boolean> {
    const prisma = getPrisma();
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
