import "server-only";

import type { CustomerPersistedWriteInput, CustomerSearchInput } from "@/domain/customers/schema";
import type { CustomerRecord, CustomerStatus } from "@/domain/customers/types";
import { getPrisma } from "@/server/db/client";
import type { Prisma } from "@/generated/prisma/client";

type CustomerRow = {
  id: string;
  displayName: string;
  contactPerson: string | null;
  customerType: CustomerRecord["customerType"];
  email: string | null;
  phone: string | null;
  alternatePhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  countryCode: string | null;
  taxRegistrationId: string | null;
  website: string | null;
  defaultInvoiceCurrencyCode: string | null;
  defaultCompanyId: string | null;
  paymentPreference: string | null;
  status: CustomerStatus;
  assignedStaffUserId: string | null;
  internalNotes: string | null;
  tags: string[];
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  companyLinks?: Array<{ companyId: string }>;
};

function mapRow(row: CustomerRow): CustomerRecord {
  return {
    id: row.id,
    displayName: row.displayName,
    contactPerson: row.contactPerson,
    customerType: row.customerType,
    email: row.email,
    phone: row.phone,
    alternatePhone: row.alternatePhone,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    city: row.city,
    region: row.region,
    postalCode: row.postalCode,
    countryCode: row.countryCode?.trim() ?? null,
    taxRegistrationId: row.taxRegistrationId,
    website: row.website,
    defaultInvoiceCurrencyCode: row.defaultInvoiceCurrencyCode?.trim() ?? null,
    defaultCompanyId: row.defaultCompanyId,
    paymentPreference: row.paymentPreference,
    status: row.status,
    assignedStaffUserId: row.assignedStaffUserId,
    internalNotes: row.internalNotes,
    tags: [...row.tags],
    companyIds: (row.companyLinks ?? []).map((link) => link.companyId),
    createdByUserId: row.createdByUserId,
    updatedByUserId: row.updatedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const withLinks = {
  companyLinks: { select: { companyId: true } },
} as const;

export type CustomerListScope =
  | { kind: "all" }
  | {
      kind: "assigned";
      companyIds: readonly string[];
    };

/**
 * Internal persistence for the customer master and company links.
 * Authorization lives in the customer service.
 * No hard-delete method (BR-012 / soft status only).
 */
export class PrismaCustomerStore {
  async getCustomerById(id: string): Promise<CustomerRecord | null> {
    const prisma = getPrisma();
    const row = await prisma.customer.findUnique({
      where: { id },
      include: withLinks,
    });
    return row ? mapRow(row) : null;
  }

  async listCustomers(
    scope: CustomerListScope,
    search: CustomerSearchInput = {},
  ): Promise<CustomerRecord[]> {
    const prisma = getPrisma();
    const where: Prisma.CustomerWhereInput = {};

    if (search.status) {
      where.status = search.status;
    }

    if (search.q) {
      const q = search.q;
      where.OR = [
        { displayName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { contactPerson: { contains: q, mode: "insensitive" } },
      ];
    }

    if (scope.kind === "assigned") {
      if (scope.companyIds.length === 0) {
        return [];
      }
      where.companyLinks = {
        some: { companyId: { in: [...scope.companyIds] } },
      };
    }

    if (search.companyId) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        { companyLinks: { some: { companyId: search.companyId } } },
      ];
    }

    const rows = await prisma.customer.findMany({
      where,
      include: withLinks,
      orderBy: [{ displayName: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(mapRow);
  }

  /**
   * Candidates for duplicate warning (TASK-028). Broad OR query; precise matching in domain.
   */
  async findPotentialDuplicates(input: {
    readonly displayName: string;
    readonly email: string | null;
    readonly phone: string | null;
    readonly excludeCustomerId?: string | null;
  }): Promise<
    Array<{
      id: string;
      displayName: string;
      email: string | null;
      phone: string | null;
      status: CustomerStatus;
    }>
  > {
    const prisma = getPrisma();
    const or: Prisma.CustomerWhereInput[] = [
      { displayName: { equals: input.displayName, mode: "insensitive" } },
    ];
    if (input.email) {
      or.push({ email: { equals: input.email, mode: "insensitive" } });
    }
    if (input.phone) {
      or.push({ phone: input.phone });
    }

    const rows = await prisma.customer.findMany({
      where: {
        OR: or,
        ...(input.excludeCustomerId ? { id: { not: input.excludeCustomerId } } : {}),
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        phone: true,
        status: true,
      },
      take: 25,
      orderBy: [{ displayName: "asc" }, { createdAt: "asc" }],
    });
    return rows;
  }

  async createCustomer(
    input: CustomerPersistedWriteInput,
    companyIds: readonly string[],
    actor?: { createdByUserId?: string | null },
  ): Promise<CustomerRecord> {
    const prisma = getPrisma();
    const created = await prisma.customer.create({
      data: {
        displayName: input.displayName,
        contactPerson: input.contactPerson,
        customerType: input.customerType,
        email: input.email,
        phone: input.phone,
        alternatePhone: input.alternatePhone,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        city: input.city,
        region: input.region,
        postalCode: input.postalCode,
        countryCode: input.countryCode,
        taxRegistrationId: input.taxRegistrationId,
        website: input.website,
        defaultInvoiceCurrencyCode: input.defaultInvoiceCurrencyCode,
        defaultCompanyId: input.defaultCompanyId,
        paymentPreference: input.paymentPreference,
        status: input.status,
        assignedStaffUserId: input.assignedStaffUserId,
        internalNotes: input.internalNotes,
        tags: [...input.tags],
        createdByUserId: actor?.createdByUserId ?? null,
        updatedByUserId: actor?.createdByUserId ?? null,
        companyLinks:
          companyIds.length > 0
            ? {
                create: companyIds.map((companyId) => ({ companyId })),
              }
            : undefined,
      },
      include: withLinks,
    });
    return mapRow(created);
  }

  async updateCustomer(
    id: string,
    input: CustomerPersistedWriteInput,
    companyIds: readonly string[],
    actor?: { updatedByUserId?: string | null },
  ): Promise<CustomerRecord> {
    const prisma = getPrisma();
    const updated = await prisma.$transaction(async (tx) => {
      await tx.customerCompany.deleteMany({ where: { customerId: id } });
      if (companyIds.length > 0) {
        await tx.customerCompany.createMany({
          data: companyIds.map((companyId) => ({ customerId: id, companyId })),
        });
      }
      return tx.customer.update({
        where: { id },
        data: {
          displayName: input.displayName,
          contactPerson: input.contactPerson,
          customerType: input.customerType,
          email: input.email,
          phone: input.phone,
          alternatePhone: input.alternatePhone,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2,
          city: input.city,
          region: input.region,
          postalCode: input.postalCode,
          countryCode: input.countryCode,
          taxRegistrationId: input.taxRegistrationId,
          website: input.website,
          defaultInvoiceCurrencyCode: input.defaultInvoiceCurrencyCode,
          defaultCompanyId: input.defaultCompanyId,
          paymentPreference: input.paymentPreference,
          status: input.status,
          assignedStaffUserId: input.assignedStaffUserId,
          internalNotes: input.internalNotes,
          tags: [...input.tags],
          updatedByUserId: actor?.updatedByUserId ?? null,
        },
        include: withLinks,
      });
    });
    return mapRow(updated);
  }

  async setCustomerCompanies(
    id: string,
    companyIds: readonly string[],
    actor?: { updatedByUserId?: string | null },
  ): Promise<CustomerRecord> {
    const prisma = getPrisma();
    const updated = await prisma.$transaction(async (tx) => {
      await tx.customerCompany.deleteMany({ where: { customerId: id } });
      if (companyIds.length > 0) {
        await tx.customerCompany.createMany({
          data: companyIds.map((companyId) => ({ customerId: id, companyId })),
        });
      }
      return tx.customer.update({
        where: { id },
        data: {
          updatedByUserId: actor?.updatedByUserId ?? undefined,
        },
        include: withLinks,
      });
    });
    return mapRow(updated);
  }

  async setStatus(
    id: string,
    status: CustomerStatus,
    actor?: { updatedByUserId?: string | null },
  ): Promise<CustomerRecord> {
    const prisma = getPrisma();
    const updated = await prisma.customer.update({
      where: { id },
      data: {
        status,
        updatedByUserId: actor?.updatedByUserId ?? undefined,
      },
      include: withLinks,
    });
    return mapRow(updated);
  }
}
