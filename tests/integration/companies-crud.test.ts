import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import {
  createCompany,
  getCompany,
  listCompanies,
  setCompanyStatus,
  updateCompany,
} from "@/server/companies/company-service";
import { PrismaCompanyStore } from "@/server/companies/company-repository";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("company CRUD integration", () => {
  const createdCompanyIds: string[] = [];

  it("records the company_crud migration when applied", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM _prisma_migrations
      WHERE migration_name = '20260820230000_company_crud'
    `;
    expect(rows).toHaveLength(1);
  });

  it("supports Admin create, read, update, and deactivate without later-task columns", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const deps = { store: new PrismaCompanyStore() };
    const principal: AuthorizationPrincipal = {
      userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1",
      status: "ACTIVE",
      roleCode: "ADMIN",
    };

    const marker = `task007-${Date.now()}`;
    const created = await createCompany(
      principal,
      {
        displayName: `Task 007 ${marker}`,
        legalName: "Task 007 Legal",
        email: "brand@example.com",
        phone: "+971500000000",
        website: "https://example.com",
        registrationTaxNumber: "TRN-007",
        addressLine1: "1 Sheikh Zayed Rd",
        addressLine2: "",
        city: "Dubai",
        region: "Dubai",
        postalCode: "00000",
        countryCode: "AE",
        status: "ACTIVE",
      },
      deps,
    );

    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error("create failed");
    }
    createdCompanyIds.push(created.data.id);
    expect(created.data.countryCode).toBe("AE");
    expect(created.data.status).toBe("ACTIVE");

    const listed = await listCompanies(principal, deps);
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.data.some((company) => company.id === created.data.id)).toBe(true);
    }

    const updated = await updateCompany(
      principal,
      created.data.id,
      {
        displayName: `Task 007 ${marker} Updated`,
        legalName: "Task 007 Legal Updated",
        email: "brand@example.com",
        phone: "+971500000000",
        website: "https://example.com",
        registrationTaxNumber: "TRN-007",
        addressLine1: "2 Sheikh Zayed Rd",
        addressLine2: "Floor 3",
        city: "Dubai",
        region: "Dubai",
        postalCode: "00000",
        countryCode: "GB",
        status: "ACTIVE",
      },
      deps,
    );
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.data.displayName).toContain("Updated");
      expect(updated.data.countryCode).toBe("GB");
      expect(updated.data.addressLine2).toBe("Floor 3");
    }

    const deactivated = await setCompanyStatus(
      principal,
      created.data.id,
      { status: "INACTIVE" },
      deps,
    );
    expect(deactivated.ok).toBe(true);
    if (deactivated.ok) {
      expect(deactivated.data.status).toBe("INACTIVE");
    }

    const persisted = await prisma.company.findUniqueOrThrow({ where: { id: created.data.id } });
    expect(persisted.status).toBe("INACTIVE");

    const fetched = await getCompany(principal, created.data.id, deps);
    expect(fetched.ok).toBe(true);

    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'companies'
    `;
    const names = columns.map((column) => column.column_name);
    expect(names).toEqual(
      expect.arrayContaining([
        "id",
        "display_name",
        "legal_name",
        "email",
        "phone",
        "website",
        "registration_tax_number",
        "address_line1",
        "address_line2",
        "city",
        "region",
        "postal_code",
        "country_code",
        "status",
        "created_at",
        "updated_at",
        "invoice_prefix",
        "terms_and_conditions",
        "email_template_reference",
        "logo_storage_key",
        "logo_mime_type",
        "logo_byte_size",
        "logo_original_filename",
        "logo_uploaded_at",
        "reporting_group_id",
      ]),
    );
    expect(names).not.toContain("invoice_sequence");
    expect(names).not.toContain("default_invoice_currency");
    expect(names).not.toContain("gateway_credentials");

    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    const tableNames = tables.map((table) => table.table_name);
    expect(tableNames).toContain("companies");
    expect(tableNames).not.toContain("company_currencies");
    expect(tableNames).not.toContain("payment_gateway_configs");
  }, 30_000);

  it("denies Staff from mutating or listing companies against the live permission matrix", async () => {
    const staffPrincipal: AuthorizationPrincipal = {
      userId: "staff-actor",
      status: "ACTIVE",
      roleCode: "STAFF",
    };
    const deps = { store: new PrismaCompanyStore() };

    const listed = await listCompanies(staffPrincipal, deps);
    expect(listed.ok).toBe(false);
    if (!listed.ok) {
      expect(listed.status).toBe(403);
    }

    const created = await createCompany(
      staffPrincipal,
      { displayName: "Unauthorized Brand" },
      deps,
    );
    expect(created.ok).toBe(false);
    if (!created.ok) {
      expect(created.status).toBe(403);
    }
  });

  afterAll(async () => {
    if (!runDbIntegration) {
      return;
    }
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    if (createdCompanyIds.length > 0) {
      await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
    }
    await prisma.$disconnect();
  });
});
