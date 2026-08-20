import "server-only";

import type { CompanyRecord, CompanyStatus } from "@/domain/companies/types";
import type { CompanyWriteInput } from "@/domain/companies/company-schema";
import { getPrisma } from "@/server/db/client";

function toCompanyRecord(company: {
  id: string;
  displayName: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  registrationTaxNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  countryCode: string | null;
  status: CompanyStatus;
  createdAt: Date;
  updatedAt: Date;
}): CompanyRecord {
  return {
    id: company.id,
    displayName: company.displayName,
    legalName: company.legalName,
    email: company.email,
    phone: company.phone,
    website: company.website,
    registrationTaxNumber: company.registrationTaxNumber,
    addressLine1: company.addressLine1,
    addressLine2: company.addressLine2,
    city: company.city,
    region: company.region,
    postalCode: company.postalCode,
    countryCode: company.countryCode?.trim() ?? null,
    status: company.status,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
  };
}

export class PrismaCompanyStore {
  async listCompanies(): Promise<CompanyRecord[]> {
    const prisma = getPrisma();
    const companies = await prisma.company.findMany({
      orderBy: [{ displayName: "asc" }, { createdAt: "asc" }],
    });
    return companies.map((company) => toCompanyRecord(company));
  }

  async getCompanyById(id: string): Promise<CompanyRecord | null> {
    const prisma = getPrisma();
    const company = await prisma.company.findUnique({ where: { id } });
    return company ? toCompanyRecord(company) : null;
  }

  async listCompaniesByIds(ids: readonly string[]): Promise<CompanyRecord[]> {
    if (ids.length === 0) {
      return [];
    }
    const prisma = getPrisma();
    const companies = await prisma.company.findMany({
      where: { id: { in: [...ids] } },
      orderBy: [{ displayName: "asc" }, { createdAt: "asc" }],
    });
    return companies.map((company) => toCompanyRecord(company));
  }

  async createCompany(input: CompanyWriteInput): Promise<CompanyRecord> {
    const prisma = getPrisma();
    const created = await prisma.company.create({
      data: {
        displayName: input.displayName,
        legalName: input.legalName,
        email: input.email,
        phone: input.phone,
        website: input.website,
        registrationTaxNumber: input.registrationTaxNumber,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        city: input.city,
        region: input.region,
        postalCode: input.postalCode,
        countryCode: input.countryCode,
        status: input.status,
      },
    });
    return toCompanyRecord(created);
  }

  async updateCompany(id: string, input: CompanyWriteInput): Promise<CompanyRecord> {
    const prisma = getPrisma();
    const updated = await prisma.company.update({
      where: { id },
      data: {
        displayName: input.displayName,
        legalName: input.legalName,
        email: input.email,
        phone: input.phone,
        website: input.website,
        registrationTaxNumber: input.registrationTaxNumber,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        city: input.city,
        region: input.region,
        postalCode: input.postalCode,
        countryCode: input.countryCode,
        status: input.status,
      },
    });
    return toCompanyRecord(updated);
  }

  async setStatus(id: string, status: CompanyStatus): Promise<CompanyRecord> {
    const prisma = getPrisma();
    const updated = await prisma.company.update({
      where: { id },
      data: { status },
    });
    return toCompanyRecord(updated);
  }
}
