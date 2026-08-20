import { describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { companyBrandingWriteSchema } from "@/domain/companies/branding-schema";
import type { CompanyBrandingRecord } from "@/domain/companies/branding-types";
import { validateCompanyLogoUpload } from "@/domain/companies/logo-validation";
import type { RoleCode } from "@/domain/authz/roles";
import {
  getCompanyBranding,
  removeCompanyLogo,
  updateCompanyBranding,
  uploadCompanyLogo,
  type CompanyBrandingDependencies,
} from "@/server/companies/branding-service";
import { MemoryStorageService } from "@/server/storage/memory-storage";

function principal(roleCode: RoleCode | null): AuthorizationPrincipal {
  return {
    userId: "actor-1",
    status: "ACTIVE",
    roleCode,
  };
}

function brandingRecord(overrides: Partial<CompanyBrandingRecord> = {}): CompanyBrandingRecord {
  return {
    companyId: "11111111-1111-4111-8111-111111111111",
    displayName: "Virtue Xolutions",
    email: "brand@example.com",
    phone: "+97100000000",
    website: "https://example.com",
    invoicePrefix: null,
    termsAndConditions: null,
    emailTemplateReference: null,
    logo: null,
    updatedAt: new Date("2026-08-20T00:00:00.000Z"),
    ...overrides,
  };
}

const PNG_BYTES = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

function createDeps(options?: { branding?: CompanyBrandingRecord }): CompanyBrandingDependencies {
  const branding = options?.branding ? { ...options.branding } : brandingRecord();
  const storage = new MemoryStorageService();
  let current = branding;

  return {
    storage,
    store: {
      async getBrandingByCompanyId(companyId: string) {
        return current.companyId === companyId ? current : null;
      },
      async updateBranding(companyId: string, input) {
        current = {
          ...current,
          companyId,
          email: input.email,
          phone: input.phone,
          website: input.website,
          invoicePrefix: input.invoicePrefix,
          termsAndConditions: input.termsAndConditions,
          emailTemplateReference: input.emailTemplateReference,
          updatedAt: new Date("2026-08-20T01:00:00.000Z"),
        };
        return current;
      },
      async setLogoMetadata(companyId: string, logo) {
        current = {
          ...current,
          companyId,
          logo: logo
            ? {
                storageKey: logo.storageKey,
                mimeType: logo.mimeType,
                byteSize: logo.byteSize,
                originalFilename: logo.originalFilename,
                uploadedAt: logo.uploadedAt,
              }
            : null,
          updatedAt: new Date("2026-08-20T02:00:00.000Z"),
        };
        return current;
      },
    },
  };
}

describe("company branding schema", () => {
  it("accepts company-specific prefix and contact fields", () => {
    const parsed = companyBrandingWriteSchema.safeParse({
      email: "hello@example.com",
      phone: "+971500000000",
      website: "https://example.com",
      invoicePrefix: "VX-",
      termsAndConditions: "Net 14.",
      emailTemplateReference: "invoice-default",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invoice sequence and other later-task fields", () => {
    expect(
      companyBrandingWriteSchema.safeParse({
        invoicePrefix: "VX-",
        invoiceSequence: 1,
      }).success,
    ).toBe(false);
    expect(
      companyBrandingWriteSchema.safeParse({
        invoicePrefix: "VX-",
        defaultInvoiceCurrency: "USD",
      }).success,
    ).toBe(false);
  });
});

describe("logo upload validation", () => {
  it("accepts PNG magic bytes and rejects oversized or mismatched MIME", () => {
    const ok = validateCompanyLogoUpload({
      bytes: PNG_BYTES,
      declaredMimeType: "image/png",
      originalFilename: "logo.png",
    });
    expect(ok.ok).toBe(true);

    const oversized = validateCompanyLogoUpload({
      bytes: Uint8Array.from({ length: 2 * 1024 * 1024 + 1 }, () => 0x89),
      declaredMimeType: "image/png",
    });
    expect(oversized.ok).toBe(false);

    const mismatch = validateCompanyLogoUpload({
      bytes: PNG_BYTES,
      declaredMimeType: "image/jpeg",
    });
    expect(mismatch.ok).toBe(false);

    const empty = validateCompanyLogoUpload({ bytes: new Uint8Array() });
    expect(empty.ok).toBe(false);
  });
});

describe("company branding authorization", () => {
  it("allows Admin to update branding and denies Staff", async () => {
    const deps = createDeps();
    const admin = await updateCompanyBranding(
      principal("ADMIN"),
      "11111111-1111-4111-8111-111111111111",
      {
        email: "brand@example.com",
        phone: "",
        website: "",
        invoicePrefix: "VX-",
        termsAndConditions: "Pay within 14 days.",
        emailTemplateReference: "invoice-default",
      },
      deps,
    );
    expect(admin.ok).toBe(true);
    if (admin.ok) {
      expect(admin.data.invoicePrefix).toBe("VX-");
      expect(admin.data.termsAndConditions).toBe("Pay within 14 days.");
    }

    const staff = await updateCompanyBranding(
      principal("STAFF"),
      "11111111-1111-4111-8111-111111111111",
      {
        email: "brand@example.com",
        phone: "",
        website: "",
        invoicePrefix: "ST-",
        termsAndConditions: "Nope",
        emailTemplateReference: "",
      },
      deps,
    );
    expect(staff.ok).toBe(false);
    if (!staff.ok) {
      expect(staff.status).toBe(403);
      expect(staff.error).toBe(GENERIC_FORBIDDEN);
    }
  });

  it("uploads a valid logo for Admin and rejects invalid uploads and Staff", async () => {
    const deps = createDeps();
    const uploaded = await uploadCompanyLogo(
      principal("ADMIN"),
      "11111111-1111-4111-8111-111111111111",
      {
        bytes: PNG_BYTES,
        declaredMimeType: "image/png",
        originalFilename: "vx.png",
      },
      deps,
    );
    expect(uploaded.ok).toBe(true);
    if (uploaded.ok) {
      expect(uploaded.data.logo?.mimeType).toBe("image/png");
      expect(uploaded.data.logo?.byteSize).toBe(PNG_BYTES.byteLength);
      expect(uploaded.data.logo?.originalFilename).toBe("vx.png");
      const stored = await deps.storage.getObject(uploaded.data.logo!.storageKey);
      expect(stored?.contentType).toBe("image/png");
    }

    const invalid = await uploadCompanyLogo(
      principal("ADMIN"),
      "11111111-1111-4111-8111-111111111111",
      {
        bytes: Uint8Array.from([0x00, 0x01, 0x02]),
        declaredMimeType: "image/png",
        originalFilename: "bad.png",
      },
      deps,
    );
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.status).toBe(400);
    }

    const staffDenied = await uploadCompanyLogo(
      principal("STAFF"),
      "11111111-1111-4111-8111-111111111111",
      {
        bytes: PNG_BYTES,
        declaredMimeType: "image/png",
        originalFilename: "staff.png",
      },
      deps,
    );
    expect(staffDenied.ok).toBe(false);
    if (!staffDenied.ok) {
      expect(staffDenied.status).toBe(403);
    }

    const removed = await removeCompanyLogo(
      principal("ADMIN"),
      "11111111-1111-4111-8111-111111111111",
      deps,
    );
    expect(removed.ok).toBe(true);
    if (removed.ok) {
      expect(removed.data.logo).toBeNull();
    }

    const fetched = await getCompanyBranding(
      principal("ADMIN"),
      "11111111-1111-4111-8111-111111111111",
      deps,
    );
    expect(fetched.ok).toBe(true);
  });
});
