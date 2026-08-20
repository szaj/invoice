import { afterAll, describe, expect, it } from "vitest";

import { ROLE_PERMISSIONS } from "@/domain/authz/matrix";
import { PERMISSION_CODES } from "@/domain/authz/permissions";
import { ROLE_CODES } from "@/domain/authz/roles";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("roles and permissions catalog", () => {
  it("records the roles_and_permissions migration when applied", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM _prisma_migrations
      WHERE migration_name = '20260820210000_roles_and_permissions'
    `;

    expect(rows).toHaveLength(1);
  });

  it("seeds Admin, Compliance, and Staff grants matching the domain matrix", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();

    const roles = await prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
    });

    expect(roles.map((role) => role.code).sort()).toEqual([...ROLE_CODES].sort());

    for (const role of roles) {
      const granted = new Set(role.permissions.map((link) => link.permission.code));
      const expected = ROLE_PERMISSIONS[role.code];

      expect([...granted].sort()).toEqual([...expected].sort());
      for (const permission of PERMISSION_CODES) {
        expect(granted.has(permission)).toBe(expected.has(permission));
      }
    }

    const staff = roles.find((role) => role.code === "STAFF");
    const staffPermissions = staff?.permissions.map((link) => link.permission.code) ?? [];
    expect(staffPermissions).not.toContain("payment.manual.record");
    expect(staffPermissions).not.toContain("invoice.view_assigned");
    expect(staffPermissions).not.toContain("report.export");
    expect(staffPermissions).not.toContain("audit.read");
    expect(staffPermissions).not.toContain("user.manage");
  });

  it("does not put companies or credentials on the RBAC tables", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    `;
    const names = tables.map((table) => table.table_name);
    expect(names).toEqual(
      expect.arrayContaining(["roles", "permissions", "role_permissions", "users"]),
    );
    expect(names).not.toContain("customers");
    expect(names).not.toContain("invoices");
    expect(names).not.toContain("payments");
  });

  afterAll(async () => {
    if (!runDbIntegration) {
      return;
    }

    const { getPrisma } = await import("@/server/db/client");
    await getPrisma().$disconnect();
  });
});
