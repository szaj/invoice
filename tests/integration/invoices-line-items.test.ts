import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { createCompany } from "@/server/companies/company-service";
import { PrismaCompanyStore } from "@/server/companies/company-repository";
import { updateCompanyCurrencyConfiguration } from "@/server/companies/company-currency-service";
import { PrismaCompanyCurrencyStore } from "@/server/companies/company-currency-repository";
import { createCustomer } from "@/server/customers/customer-service";
import { PrismaCustomerStore } from "@/server/customers/customer-repository";
import { createDraftInvoice } from "@/server/invoices/invoice-draft-service";
import { replaceDraftInvoiceLineItems } from "@/server/invoices/invoice-line-item-service";
import { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("invoice line items nested write integration", () => {
  const createdInvoiceIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdCompanyIds: string[] = [];

  it("replaces draft line items with server-calculated totals", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const invoiceDeps = {
      store: new PrismaInvoiceStore(),
      customerStore: new PrismaCustomerStore(),
    };
    const companyDeps = { store: new PrismaCompanyStore() };
    const customerDeps = { store: new PrismaCustomerStore() };
    const currencyDeps = { store: new PrismaCompanyCurrencyStore() };
    const lineDeps = {
      store: new PrismaInvoiceStore(),
      currencyStore: new (
        await import("@/server/currencies/currency-repository")
      ).PrismaCurrencyStore(),
    };

    const adminId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee81";
    const admin: AuthorizationPrincipal = {
      userId: adminId,
      status: "ACTIVE",
      roleCode: "ADMIN",
    };

    await prisma.user.upsert({
      where: { id: adminId },
      create: {
        id: adminId,
        name: "TASK-033 Admin",
        email: `task033-admin-${Date.now()}@example.com`,
        supabaseAuthUserId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee82",
        status: "ACTIVE",
      },
      update: {},
    });

    const company = await createCompany(
      admin,
      { displayName: `Invoice Lines Co ${Date.now()}` },
      companyDeps,
    );
    expect(company.ok).toBe(true);
    if (!company.ok) {
      throw new Error("company create failed");
    }
    createdCompanyIds.push(company.data.id);

    const usd = await prisma.currency.findUniqueOrThrow({ where: { code: "USD" } });
    const currencies = await updateCompanyCurrencyConfiguration(
      admin,
      company.data.id,
      { enabledCurrencyIds: [usd.id], defaultCurrencyId: usd.id },
      currencyDeps,
    );
    expect(currencies.ok).toBe(true);

    const customer = await createCustomer(
      admin,
      {
        displayName: `Line Customer ${Date.now()}`,
        customerType: "BUSINESS",
        companyIds: [company.data.id],
        defaultCompanyId: company.data.id,
      },
      customerDeps,
    );
    expect(customer.ok).toBe(true);
    if (!customer.ok) {
      throw new Error("customer create failed");
    }
    createdCustomerIds.push(customer.data.id);

    const draft = await createDraftInvoice(
      admin,
      {
        companyId: company.data.id,
        customerId: customer.data.id,
        invoiceDate: "2026-08-21",
        dueDate: "2026-09-21",
        currencyCode: "USD",
      },
      invoiceDeps,
    );
    expect(draft.ok).toBe(true);
    if (!draft.ok) {
      throw new Error("draft create failed");
    }
    createdInvoiceIds.push(draft.data.id);

    const replaced = await replaceDraftInvoiceLineItems(
      admin,
      draft.data.id,
      {
        lineItems: [
          {
            description: "Discovery workshop",
            quantity: "2",
            unitRate: "150.00",
            taxName: "VAT",
            taxRatePercent: "5",
          },
          {
            description: "Support hours",
            quantity: "1.5",
            unitRate: "80.00",
            taxName: null,
            taxRatePercent: null,
          },
        ],
      },
      lineDeps,
    );
    expect(replaced.ok).toBe(true);
    if (!replaced.ok) {
      throw new Error("line replace failed");
    }
    expect(replaced.data).toHaveLength(2);
    expect(replaced.data[0]?.lineTotal).toBe("300");
    expect(replaced.data[1]?.lineTotal).toBe("120");
    expect(replaced.data[0]?.taxName).toBe("VAT");
    expect(replaced.data[0]?.taxRatePercent).toBe("5");

    const refreshed = await prisma.invoice.findUniqueOrThrow({ where: { id: draft.data.id } });
    expect(refreshed.subtotal.toString()).toBe("420");
    expect(refreshed.discountTotal.toString()).toBe("0");
    expect(refreshed.taxTotal.toString()).toBe("15");
    expect(refreshed.invoiceTotal.toString()).toBe("435");
    expect(refreshed.confirmedPaidAmount.toString()).toBe("0");
    expect(refreshed.outstandingAmount.toString()).toBe("435");

    const rejectedQty = await replaceDraftInvoiceLineItems(
      admin,
      draft.data.id,
      {
        lineItems: [
          {
            description: "Bad qty",
            quantity: "0",
            unitRate: "10.00",
            taxName: null,
            taxRatePercent: null,
          },
        ],
      },
      lineDeps,
    );
    expect(rejectedQty.ok).toBe(false);

    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    expect(tables.map((t) => t.table_name)).toContain("invoice_items");
  }, 90_000);

  afterAll(async () => {
    if (!runDbIntegration) {
      return;
    }
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    if (createdInvoiceIds.length > 0) {
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: { in: createdInvoiceIds } } });
      await prisma.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } });
    }
    if (createdCustomerIds.length > 0) {
      await prisma.customerCompany.deleteMany({
        where: { customerId: { in: createdCustomerIds } },
      });
      await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
    }
    if (createdCompanyIds.length > 0) {
      await prisma.companyCurrency.deleteMany({
        where: { companyId: { in: createdCompanyIds } },
      });
      await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
    }
    await prisma.user.deleteMany({
      where: { id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee81" },
    });
    await prisma.$disconnect();
  });
});
