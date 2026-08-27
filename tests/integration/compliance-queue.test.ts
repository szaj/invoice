import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import { COMPLIANCE_QUEUE_FORBIDDEN } from "@/domain/compliance/types";
import { updateCompanyBranding } from "@/server/companies/branding-service";
import { PrismaCompanyBrandingStore } from "@/server/companies/branding-repository";
import { createCompany } from "@/server/companies/company-service";
import { PrismaCompanyStore } from "@/server/companies/company-repository";
import { updateCompanyCurrencyConfiguration } from "@/server/companies/company-currency-service";
import { PrismaCompanyCurrencyStore } from "@/server/companies/company-currency-repository";
import {
  listComplianceQueue,
  updateComplianceStatus,
} from "@/server/compliance/compliance-service";
import { PrismaComplianceStore } from "@/server/compliance/compliance-repository";
import { createCustomer } from "@/server/customers/customer-service";
import { PrismaCustomerStore } from "@/server/customers/customer-repository";
import { createDraftInvoice } from "@/server/invoices/invoice-draft-service";
import { issueInvoice } from "@/server/invoices/invoice-lifecycle-service";
import { PrismaInvoiceNumberStore } from "@/server/invoices/invoice-number-repository";
import { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";
import { replaceDraftInvoiceLineItems } from "@/server/invoices/invoice-line-item-service";
import { recordManualPayment } from "@/server/payments/payment-service";
import { PrismaPaymentStore } from "@/server/payments/payment-repository";
import { MemoryStorageService } from "@/server/storage/memory-storage";
import { updatePaymentMethodSettlementConfiguration } from "@/server/settlement/settlement-service";
import { PrismaSettlementConfigStore } from "@/server/settlement/settlement-repository";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("compliance review queue integration (TASK-072)", () => {
  const createdPaymentIds: string[] = [];
  const createdInvoiceIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdCompanyIds: string[] = [];
  const createdReviewIds: string[] = [];
  const createdUserIds: string[] = [];
  let assignedUserCompany: { userId: string; companyId: string } | null = null;

  it("scopes queue to assigned companies and denies unassigned company filter", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const companyDeps = { store: new PrismaCompanyStore() };
    const brandingDeps = {
      store: new PrismaCompanyBrandingStore(),
      storage: new MemoryStorageService(),
    };
    const currencyDeps = { store: new PrismaCompanyCurrencyStore() };
    const customerDeps = { store: new PrismaCustomerStore() };
    const invoiceDeps = {
      store: new PrismaInvoiceStore(),
      customerStore: new PrismaCustomerStore(),
    };
    const lineDeps = {
      store: new PrismaInvoiceStore(),
      currencyStore: new (
        await import("@/server/currencies/currency-repository")
      ).PrismaCurrencyStore(),
    };
    const lifecycleDeps = {
      invoices: new PrismaInvoiceStore(),
      numbers: new PrismaInvoiceNumberStore(),
      skipPdfGeneration: true,
    };
    const settlementDeps = { store: new PrismaSettlementConfigStore() };
    const paymentDeps = {
      payments: new PrismaPaymentStore(),
      invoices: new PrismaInvoiceStore(),
      customers: new PrismaCustomerStore(),
      settlement: new PrismaSettlementConfigStore(),
      currencies: new (
        await import("@/server/currencies/currency-repository")
      ).PrismaCurrencyStore(),
      enforceTransactionalCompanyScope: async (
        actor: AuthorizationPrincipal,
        companyId: string,
      ) => {
        assertCompanyAccess(actor, companyId);
        return { ok: true as const, data: true as const };
      },
    };
    const complianceDeps = {
      store: new PrismaComplianceStore(),
      invoices: new PrismaInvoiceStore(),
      payments: new PrismaPaymentStore(),
      customers: new PrismaCustomerStore(),
      enforceTransactionalCompanyScope: paymentDeps.enforceTransactionalCompanyScope,
    };

    const adminId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee82";
    const adminAuthId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee83";
    const complianceUserId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee84";
    const complianceAuthId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee85";
    const complianceRole = await prisma.role.findUniqueOrThrow({ where: { code: "COMPLIANCE" } });

    await prisma.user.deleteMany({
      where: {
        OR: [
          { id: { in: [adminId, complianceUserId] } },
          { supabaseAuthUserId: { in: [adminAuthId, complianceAuthId] } },
        ],
      },
    });

    await prisma.user.create({
      data: {
        id: adminId,
        name: "TASK-072 Admin",
        email: `task072-admin-${Date.now()}@example.com`,
        supabaseAuthUserId: adminAuthId,
        status: "ACTIVE",
      },
    });
    createdUserIds.push(adminId);

    await prisma.user.create({
      data: {
        id: complianceUserId,
        name: "TASK-072 Compliance",
        email: `task072-compliance-${Date.now()}@example.com`,
        supabaseAuthUserId: complianceAuthId,
        status: "ACTIVE",
        roleId: complianceRole.id,
      },
    });
    createdUserIds.push(complianceUserId);

    const admin: AuthorizationPrincipal = {
      userId: adminId,
      status: "ACTIVE",
      roleCode: "ADMIN",
    };

    async function provisionCompany(label: string) {
      const company = await createCompany(
        admin,
        { displayName: `Queue Co ${label} ${Date.now()}` },
        companyDeps,
      );
      expect(company.ok).toBe(true);
      if (!company.ok) {
        throw new Error("company create failed");
      }
      createdCompanyIds.push(company.data.id);

      await updateCompanyBranding(
        admin,
        company.data.id,
        {
          email: null,
          phone: null,
          website: null,
          invoicePrefix: `Q${label}-`,
          termsAndConditions: null,
          emailTemplateReference: null,
        },
        brandingDeps,
      );

      const usd = await prisma.currency.findUniqueOrThrow({ where: { code: "USD" } });
      await updateCompanyCurrencyConfiguration(
        admin,
        company.data.id,
        { enabledCurrencyIds: [usd.id], defaultCurrencyId: usd.id },
        currencyDeps,
      );

      const settlement = await updatePaymentMethodSettlementConfiguration(
        admin,
        company.data.id,
        "MANUAL",
        { methodEnabled: true, enabledSettlementCurrencyCodes: ["USD"] },
        settlementDeps,
      );
      expect(settlement.ok).toBe(true);

      const customer = await createCustomer(
        admin,
        {
          displayName: `Queue Customer ${label} ${Date.now()}`,
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
          invoiceDate: "2026-08-10",
          dueDate: "2026-08-31",
          currencyCode: "USD",
        },
        invoiceDeps,
      );
      expect(draft.ok).toBe(true);
      if (!draft.ok) {
        throw new Error("draft create failed");
      }
      createdInvoiceIds.push(draft.data.id);

      await replaceDraftInvoiceLineItems(
        admin,
        draft.data.id,
        {
          lineItems: [{ description: "Service", quantity: "1", unitRate: "50.00" }],
        },
        lineDeps,
      );

      const issued = await issueInvoice(admin, draft.data.id, lifecycleDeps);
      expect(issued.ok).toBe(true);

      const payment = await recordManualPayment(
        admin,
        {
          invoiceId: draft.data.id,
          invoiceAmountApplied: "25.00",
          settlementCurrencyCode: "USD",
          paymentDate: "2026-08-12",
        },
        paymentDeps,
      );
      expect(payment.ok).toBe(true);
      if (!payment.ok) {
        throw new Error("payment create failed");
      }
      createdPaymentIds.push(payment.data.id);

      await updateComplianceStatus(
        admin,
        {
          subjectType: "INVOICE",
          subjectId: draft.data.id,
          status: "UNDER_REVIEW",
        },
        complianceDeps,
      ).then((result) => {
        if (result.ok && result.data.review) {
          createdReviewIds.push(result.data.review.id);
        }
      });

      return {
        companyId: company.data.id,
        invoiceId: draft.data.id,
        paymentId: payment.data.id,
        customerId: customer.data.id,
      };
    }

    const assigned = await provisionCompany("A");
    const unassigned = await provisionCompany("B");

    await prisma.userCompany.create({
      data: {
        userId: complianceUserId,
        companyId: assigned.companyId,
      },
    });
    assignedUserCompany = { userId: complianceUserId, companyId: assigned.companyId };

    const complianceActor: AuthorizationPrincipal = {
      userId: complianceUserId,
      status: "ACTIVE",
      roleCode: "COMPLIANCE",
      assignedCompanyIds: [assigned.companyId],
    };

    const scoped = await listComplianceQueue(
      complianceActor,
      { status: "UNDER_REVIEW", subjectType: "INVOICE" },
      complianceDeps,
    );
    expect(scoped.ok).toBe(true);
    if (!scoped.ok) {
      throw new Error("scoped queue failed");
    }
    expect(scoped.data.every((item) => item.companyId === assigned.companyId)).toBe(true);
    expect(scoped.data.some((item) => item.subjectId === assigned.invoiceId)).toBe(true);
    expect(scoped.data.some((item) => item.subjectId === unassigned.invoiceId)).toBe(false);

    const denied = await listComplianceQueue(
      complianceActor,
      { companyId: unassigned.companyId },
      complianceDeps,
    );
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.status).toBe(403);
      expect(denied.error).toBe(COMPLIANCE_QUEUE_FORBIDDEN);
    }

    const adminQueue = await listComplianceQueue(
      admin,
      { status: "UNDER_REVIEW", subjectType: "INVOICE" },
      complianceDeps,
    );
    expect(adminQueue.ok).toBe(true);
    if (adminQueue.ok) {
      expect(adminQueue.data.some((item) => item.subjectId === assigned.invoiceId)).toBe(true);
      expect(adminQueue.data.some((item) => item.subjectId === unassigned.invoiceId)).toBe(true);
    }

    const filtered = await listComplianceQueue(
      complianceActor,
      {
        companyId: assigned.companyId,
        currency: "USD",
        amountMin: "20.00",
        amountMax: "60.00",
        gateway: "MANUAL",
        subjectType: "PAYMENT",
      },
      complianceDeps,
    );
    expect(filtered.ok).toBe(true);
    if (filtered.ok) {
      expect(filtered.data.every((item) => item.subjectType === "PAYMENT")).toBe(true);
      expect(filtered.data.every((item) => item.companyId === assigned.companyId)).toBe(true);
      expect(filtered.data.some((item) => item.subjectId === assigned.paymentId)).toBe(true);
    }
  }, 180_000);

  afterAll(async () => {
    if (!runDbIntegration) {
      return;
    }
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    if (createdReviewIds.length > 0) {
      await prisma.complianceReview.deleteMany({ where: { id: { in: createdReviewIds } } });
    }
    if (createdPaymentIds.length > 0) {
      await prisma.payment.deleteMany({ where: { id: { in: createdPaymentIds } } });
    }
    if (createdInvoiceIds.length > 0) {
      await prisma.invoiceFile.deleteMany({ where: { invoiceId: { in: createdInvoiceIds } } });
      await prisma.invoiceVersion.deleteMany({
        where: { invoiceId: { in: createdInvoiceIds } },
      });
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: { in: createdInvoiceIds } } });
      await prisma.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } });
    }
    if (createdCustomerIds.length > 0) {
      await prisma.customerCompany.deleteMany({
        where: { customerId: { in: createdCustomerIds } },
      });
      await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
    }
    if (assignedUserCompany) {
      await prisma.userCompany.deleteMany({
        where: {
          userId: assignedUserCompany.userId,
          companyId: assignedUserCompany.companyId,
        },
      });
    }
    if (createdCompanyIds.length > 0) {
      await prisma.paymentGatewaySettlementCurrency.deleteMany({
        where: { gatewayConfig: { companyId: { in: createdCompanyIds } } },
      });
      await prisma.paymentGatewayConfig.deleteMany({
        where: { companyId: { in: createdCompanyIds } },
      });
      await prisma.companyCurrency.deleteMany({
        where: { companyId: { in: createdCompanyIds } },
      });
      await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });
});
