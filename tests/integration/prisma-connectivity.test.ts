import { afterAll, describe, expect, it } from "vitest";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("prisma connectivity", () => {
  it("has a runtime DATABASE_URL", () => {
    expect(process.env.DATABASE_URL?.startsWith("postgres")).toBe(true);
  });

  it("connects to PostgreSQL", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1::int AS ok`;

    expect(rows[0]?.ok).toBe(1);
  });

  it("records the foundation migration when applied", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM _prisma_migrations
      WHERE migration_name = '20260820120000_database_foundation'
    `;

    expect(rows).toHaveLength(1);
  });

  afterAll(async () => {
    if (!runDbIntegration) {
      return;
    }

    const { getPrisma } = await import("@/server/db/client");
    await getPrisma().$disconnect();
  });
});
