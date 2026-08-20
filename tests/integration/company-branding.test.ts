import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import {
  getCompanyBranding,
  removeCompanyLogo,
  updateCompanyBranding,
  uploadCompanyLogo,
} from "@/server/companies/branding-service";
import { PrismaCompanyBrandingStore } from "@/server/companies/branding-repository";
import { createCompany } from "@/server/companies/company-service";
import { PrismaCompanyStore } from "@/server/companies/company-repository";
import { MemoryStorageService } from "@/server/storage/memory-storage";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

const PNG_BYTES = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

describe.skipIf(!runDbIntegration)("company branding integration", () => {
  const createdCompanyIds: string[] = [];

  it("records the company_branding migration when applied", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM _prisma_migrations
      WHERE migration_name = '20260820250000_company_branding'
    `;
    expect(rows).toHaveLength(1);
  });

  it("supports Admin branding update and logo upload validation against live DB", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const companyDeps = { store: new PrismaCompanyStore() };
    const storage = new MemoryStorageService();
    const brandingDeps = { store: new PrismaCompanyBrandingStore(), storage };
    const admin: AuthorizationPrincipal = {
      userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee2",
      status: "ACTIVE",
      roleCode: "ADMIN",
    };

    const marker = `task010-${Date.now()}`;
    const created = await createCompany(
      admin,
      {
        displayName: `Task 010 ${marker}`,
        legalName: "Task 010 Legal",
        email: "brand@example.com",
        phone: "+971500000000",
        website: "https://example.com",
        registrationTaxNumber: "TRN-010",
        addressLine1: "1 Sheikh Zayed Rd",
        addressLine2: "",
        city: "Dubai",
        region: "Dubai",
        postalCode: "00000",
        countryCode: "AE",
        status: "ACTIVE",
      },
      companyDeps,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error("create failed");
    }
    createdCompanyIds.push(created.data.id);

    const updated = await updateCompanyBranding(
      admin,
      created.data.id,
      {
        email: "branding@example.com",
        phone: "+971511111111",
        website: "https://brand.example.com",
        invoicePrefix: "VX-",
        termsAndConditions: "Payment due in 14 days.",
        emailTemplateReference: "invoice-default",
      },
      brandingDeps,
    );
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.data.invoicePrefix).toBe("VX-");
      expect(updated.data.emailTemplateReference).toBe("invoice-default");
      expect(updated.data.termsAndConditions).toContain("14 days");
    }

    const uploaded = await uploadCompanyLogo(
      admin,
      created.data.id,
      {
        bytes: PNG_BYTES,
        declaredMimeType: "image/png",
        originalFilename: "vx-logo.png",
      },
      brandingDeps,
    );
    expect(uploaded.ok).toBe(true);
    if (uploaded.ok) {
      expect(uploaded.data.logo?.mimeType).toBe("image/png");
      expect(uploaded.data.logo?.originalFilename).toBe("vx-logo.png");
    }

    const invalid = await uploadCompanyLogo(
      admin,
      created.data.id,
      {
        bytes: Uint8Array.from([1, 2, 3, 4]),
        declaredMimeType: "image/png",
        originalFilename: "bad.png",
      },
      brandingDeps,
    );
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.status).toBe(400);
    }

    const staff: AuthorizationPrincipal = {
      userId: "staff-actor",
      status: "ACTIVE",
      roleCode: "STAFF",
    };
    const staffDenied = await updateCompanyBranding(
      staff,
      created.data.id,
      {
        email: "x@example.com",
        phone: "",
        website: "",
        invoicePrefix: "NO-",
        termsAndConditions: "denied",
        emailTemplateReference: "",
      },
      brandingDeps,
    );
    expect(staffDenied.ok).toBe(false);
    if (!staffDenied.ok) {
      expect(staffDenied.status).toBe(403);
    }

    const fetched = await getCompanyBranding(admin, created.data.id, brandingDeps);
    expect(fetched.ok).toBe(true);

    const removed = await removeCompanyLogo(admin, created.data.id, brandingDeps);
    expect(removed.ok).toBe(true);
    if (removed.ok) {
      expect(removed.data.logo).toBeNull();
    }

    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'companies'
    `;
    const names = columns.map((column) => column.column_name);
    expect(names).toEqual(
      expect.arrayContaining([
        "invoice_prefix",
        "terms_and_conditions",
        "email_template_reference",
        "logo_storage_key",
        "logo_mime_type",
        "logo_byte_size",
        "logo_original_filename",
        "logo_uploaded_at",
      ]),
    );
    expect(names).not.toContain("invoice_sequence");
    expect(names).not.toContain("default_invoice_currency");
    expect(names).not.toContain("gateway_credentials");
  }, 30_000);

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
