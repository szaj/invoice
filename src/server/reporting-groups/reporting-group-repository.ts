import "server-only";

import type {
  ReportingGroupMember,
  ReportingGroupRecord,
  ReportingGroupStatus,
} from "@/domain/reporting-groups/types";
import type { ReportingGroupWriteInput } from "@/domain/reporting-groups/schema";
import { getPrisma } from "@/server/db/client";

type GroupRow = {
  id: string;
  name: string;
  code: string;
  status: ReportingGroupStatus;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
  companies: Array<{
    id: string;
    displayName: string;
    status: "ACTIVE" | "INACTIVE";
  }>;
};

function toMember(company: GroupRow["companies"][number]): ReportingGroupMember {
  return {
    id: company.id,
    displayName: company.displayName,
    status: company.status,
  };
}

export function toReportingGroupRecord(row: GroupRow): ReportingGroupRecord {
  const companies = [...row.companies]
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .map(toMember);
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    status: row.status,
    displayOrder: row.displayOrder,
    companyIds: companies.map((company) => company.id),
    companies,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const groupInclude = {
  companies: {
    select: {
      id: true,
      displayName: true,
      status: true,
    },
  },
} as const;

export class PrismaReportingGroupStore {
  async listGroups(): Promise<ReportingGroupRecord[]> {
    const prisma = getPrisma();
    const rows = await prisma.companyGroup.findMany({
      include: groupInclude,
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }, { createdAt: "asc" }],
    });
    return rows.map((row) => toReportingGroupRecord(row));
  }

  async getGroupById(id: string): Promise<ReportingGroupRecord | null> {
    const prisma = getPrisma();
    const row = await prisma.companyGroup.findUnique({
      where: { id },
      include: groupInclude,
    });
    return row ? toReportingGroupRecord(row) : null;
  }

  async findByCode(code: string): Promise<ReportingGroupRecord | null> {
    const prisma = getPrisma();
    const row = await prisma.companyGroup.findUnique({
      where: { code },
      include: groupInclude,
    });
    return row ? toReportingGroupRecord(row) : null;
  }

  async createGroup(input: ReportingGroupWriteInput): Promise<ReportingGroupRecord> {
    const prisma = getPrisma();
    const created = await prisma.$transaction(async (tx) => {
      const group = await tx.companyGroup.create({
        data: {
          name: input.name,
          code: input.code,
          status: input.status,
          displayOrder: input.displayOrder,
        },
      });

      if (input.companyIds.length > 0) {
        await tx.company.updateMany({
          where: { id: { in: [...input.companyIds] } },
          data: { reportingGroupId: group.id },
        });
      }

      return tx.companyGroup.findUniqueOrThrow({
        where: { id: group.id },
        include: groupInclude,
      });
    });

    return toReportingGroupRecord(created);
  }

  async updateGroup(id: string, input: ReportingGroupWriteInput): Promise<ReportingGroupRecord> {
    const prisma = getPrisma();
    const updated = await prisma.$transaction(async (tx) => {
      await tx.companyGroup.update({
        where: { id },
        data: {
          name: input.name,
          code: input.code,
          status: input.status,
          displayOrder: input.displayOrder,
        },
      });

      await tx.company.updateMany({
        where: { reportingGroupId: id },
        data: { reportingGroupId: null },
      });

      if (input.companyIds.length > 0) {
        await tx.company.updateMany({
          where: { id: { in: [...input.companyIds] } },
          data: { reportingGroupId: id },
        });
      }

      return tx.companyGroup.findUniqueOrThrow({
        where: { id },
        include: groupInclude,
      });
    });

    return toReportingGroupRecord(updated);
  }

  async setStatus(id: string, status: ReportingGroupStatus): Promise<ReportingGroupRecord> {
    const prisma = getPrisma();
    const updated = await prisma.companyGroup.update({
      where: { id },
      data: { status },
      include: groupInclude,
    });
    return toReportingGroupRecord(updated);
  }

  async countExistingCompanies(companyIds: readonly string[]): Promise<number> {
    if (companyIds.length === 0) {
      return 0;
    }
    const prisma = getPrisma();
    return prisma.company.count({
      where: { id: { in: [...companyIds] } },
    });
  }
}
