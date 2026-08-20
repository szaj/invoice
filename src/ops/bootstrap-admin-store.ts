import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

import { blankToUndefined } from "@/config/env-schema";
import {
  isKnownRoleCode,
  type BootstrapAdminStore,
  type BootstrapAdminUserRecord,
} from "@/domain/ops/bootstrap-admin";

/**
 * Operational Prisma access for CLI tooling.
 * Intentionally separate from the Next.js server-only client so bootstrap does not
 * depend on runtime request context and cannot be imported as an HTTP backdoor.
 */
export function createOpsPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
}

export function requireOpsDatabaseUrl(source: NodeJS.ProcessEnv = process.env): string {
  const url = blankToUndefined(source.DATABASE_URL);
  if (!url) {
    throw new Error("DATABASE_URL is required for bootstrap:admin");
  }
  if (!url.startsWith("postgres://") && !url.startsWith("postgresql://")) {
    throw new Error("DATABASE_URL must be a PostgreSQL connection URL");
  }
  return url;
}

export class PrismaBootstrapAdminStore implements BootstrapAdminStore {
  constructor(private readonly prisma: PrismaClient) {}

  async findUserByEmail(normalizedEmail: string): Promise<BootstrapAdminUserRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        status: true,
        supabaseAuthUserId: true,
        roleId: true,
        role: { select: { code: true } },
      },
    });

    if (!user) {
      return null;
    }

    const roleCode = user.role?.code ?? null;
    const hasUnresolvedRole = user.roleId !== null && !isKnownRoleCode(roleCode);

    return {
      id: user.id,
      email: user.email,
      status: user.status,
      supabaseAuthUserId: user.supabaseAuthUserId,
      roleCode: isKnownRoleCode(roleCode) ? roleCode : null,
      hasUnresolvedRole,
    };
  }

  async findAdminRoleId(): Promise<string | null> {
    const role = await this.prisma.role.findUnique({
      where: { code: "ADMIN" },
      select: { id: true },
    });
    return role?.id ?? null;
  }

  async assignAdminRole(userId: string, adminRoleId: string): Promise<void> {
    const updated = await this.prisma.user.updateMany({
      where: {
        id: userId,
        roleId: null,
        status: "ACTIVE",
      },
      data: { roleId: adminRoleId },
    });

    if (updated.count !== 1) {
      throw new Error("Bootstrap Admin assignment did not apply (user changed concurrently).");
    }
  }
}
