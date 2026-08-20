import "server-only";

import type { CompanyBrandingRecord, CompanyLogoMetadata } from "@/domain/companies/branding-types";
import type { CompanyBrandingWriteInput } from "@/domain/companies/branding-schema";
import { getPrisma } from "@/server/db/client";

type CompanyBrandingRow = {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  invoicePrefix: string | null;
  termsAndConditions: string | null;
  emailTemplateReference: string | null;
  logoStorageKey: string | null;
  logoMimeType: string | null;
  logoByteSize: number | null;
  logoOriginalFilename: string | null;
  logoUploadedAt: Date | null;
  updatedAt: Date;
};

function toLogoMetadata(row: CompanyBrandingRow): CompanyLogoMetadata | null {
  if (
    !row.logoStorageKey ||
    !row.logoMimeType ||
    row.logoByteSize === null ||
    !row.logoUploadedAt
  ) {
    return null;
  }
  return {
    storageKey: row.logoStorageKey,
    mimeType: row.logoMimeType,
    byteSize: row.logoByteSize,
    originalFilename: row.logoOriginalFilename,
    uploadedAt: row.logoUploadedAt,
  };
}

export function toCompanyBrandingRecord(row: CompanyBrandingRow): CompanyBrandingRecord {
  return {
    companyId: row.id,
    displayName: row.displayName,
    email: row.email,
    phone: row.phone,
    website: row.website,
    invoicePrefix: row.invoicePrefix,
    termsAndConditions: row.termsAndConditions,
    emailTemplateReference: row.emailTemplateReference,
    logo: toLogoMetadata(row),
    updatedAt: row.updatedAt,
  };
}

export type CompanyLogoMetadataWrite = {
  readonly storageKey: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly originalFilename: string | null;
  readonly uploadedAt: Date;
};

export class PrismaCompanyBrandingStore {
  async getBrandingByCompanyId(companyId: string): Promise<CompanyBrandingRecord | null> {
    const prisma = getPrisma();
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        displayName: true,
        email: true,
        phone: true,
        website: true,
        invoicePrefix: true,
        termsAndConditions: true,
        emailTemplateReference: true,
        logoStorageKey: true,
        logoMimeType: true,
        logoByteSize: true,
        logoOriginalFilename: true,
        logoUploadedAt: true,
        updatedAt: true,
      },
    });
    return company ? toCompanyBrandingRecord(company) : null;
  }

  async updateBranding(
    companyId: string,
    input: CompanyBrandingWriteInput,
  ): Promise<CompanyBrandingRecord> {
    const prisma = getPrisma();
    const updated = await prisma.company.update({
      where: { id: companyId },
      data: {
        email: input.email,
        phone: input.phone,
        website: input.website,
        invoicePrefix: input.invoicePrefix,
        termsAndConditions: input.termsAndConditions,
        emailTemplateReference: input.emailTemplateReference,
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        phone: true,
        website: true,
        invoicePrefix: true,
        termsAndConditions: true,
        emailTemplateReference: true,
        logoStorageKey: true,
        logoMimeType: true,
        logoByteSize: true,
        logoOriginalFilename: true,
        logoUploadedAt: true,
        updatedAt: true,
      },
    });
    return toCompanyBrandingRecord(updated);
  }

  async setLogoMetadata(
    companyId: string,
    logo: CompanyLogoMetadataWrite | null,
  ): Promise<CompanyBrandingRecord> {
    const prisma = getPrisma();
    const updated = await prisma.company.update({
      where: { id: companyId },
      data: logo
        ? {
            logoStorageKey: logo.storageKey,
            logoMimeType: logo.mimeType,
            logoByteSize: logo.byteSize,
            logoOriginalFilename: logo.originalFilename,
            logoUploadedAt: logo.uploadedAt,
          }
        : {
            logoStorageKey: null,
            logoMimeType: null,
            logoByteSize: null,
            logoOriginalFilename: null,
            logoUploadedAt: null,
          },
      select: {
        id: true,
        displayName: true,
        email: true,
        phone: true,
        website: true,
        invoicePrefix: true,
        termsAndConditions: true,
        emailTemplateReference: true,
        logoStorageKey: true,
        logoMimeType: true,
        logoByteSize: true,
        logoOriginalFilename: true,
        logoUploadedAt: true,
        updatedAt: true,
      },
    });
    return toCompanyBrandingRecord(updated);
  }
}
