import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

import { requireRuntimeDatabaseUrl } from "@/config/env";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: requireRuntimeDatabaseUrl(),
  });

  return new PrismaClient({ adapter });
}

/**
 * Server-only Prisma client. Reuses one instance across Next.js hot reloads.
 * Runtime traffic uses pooled DATABASE_URL, not DIRECT_URL.
 */
export function getPrisma(): PrismaClient {
  globalForPrisma.prisma ??= createPrismaClient();
  return globalForPrisma.prisma;
}
