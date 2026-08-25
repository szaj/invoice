import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import { AuditActions } from "@/domain/audit/types";
import { COMPLIANCE_STATUS_FORBIDDEN } from "@/domain/compliance/types";
import { updateCompanyBranding } from "@/server/companies/branding-service";
import { PrismaCompanyBrandingStore } from "@/server/companies/branding-repository";
import { createCompany } from "@/server/companies/company-service";
import { PrismaCompanyStore } from "@/server/companies/company-repository";
import { updateCompanyCurrencyConfiguration } from "@/server/companies/company-currency-service";
import { PrismaCompanyCurrencyStore } from "@/server/companies/company-currency-repository";
import { updateComplianceStatus } from "@/server/compliance/compliance-service";
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

describe.skipIf(!runDbIntegration)("compliance status model integration (TASK-071)", () => {
  const createdPaymentIds: string[] = [];
  const createdInvoiceIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdCompanyIds: string[] = [];
  const createdReviewIds: string[] = [];
  const createdUserIds: string[] = [];

  it("updates invoice/payment/customer status for Admin and denies Staff", async () => {
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

    const adminId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee71";
    const adminAuthId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee72";
    const admin: AuthorizationPrincipal = {
      userId: adminId,
      status: "ACTIVE",
      roleCode: "ADMIN",
    };
    const staff: AuthorizationPrincipal = {
      userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee73",
      status: "ACTIVE",
      roleCode: "STAFF",
      assignedCompanyIds: [],
    };

    await prisma.user.deleteMany({
      where: {
        OR: [{ id: adminId }, { supabaseAuthUserId: adminAuthId }],
      },
    });
    await prisma.user.create({
      data: {
        id: adminId,
        name: "TASK-071 Admin",
        email: `task071-admin-${Date.now()}@example.com`,
        supabaseAuthUserId: adminAuthId,
        status: "ACTIVE",
      },
    });
    createdUserIds.push(adminId);

    const company = await createCompany(
      admin,
      { displayName: `Compliance Co ${Date.now()}` },
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
        invoicePrefix: "CM-",
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
        displayName: `Compliance Customer ${Date.now()}`,
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
    expect(customer.data.complianceStatus).toBe("NOT_REVIEWED");

    const draft = await createDraftInvoice(
      admin,
      {
        companyId: company.data.id,
        customerId: customer.data.id,
        invoiceDate: "2026-08-01",
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
    expect(draft.data.complianceStatus).toBe("NOT_REVIEWED");

    await replaceDraftInvoiceLineItems(
      admin,
      draft.data.id,
      {
        lineItems: [{ description: "Service", quantity: "1", unitRate: "80.00" }],
      },
      lineDeps,
    );

    const issued = await issueInvoice(admin, draft.data.id, lifecycleDeps);
    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      throw new Error(issued.error);
    }

    const staffDenied = await updateComplianceStatus(
      staff,
      {
        subjectType: "INVOICE",
        subjectId: draft.data.id,
        status: "UNDER_REVIEW",
      },
      complianceDeps,
    );
    expect(staffDenied.ok).toBe(false);
    if (!staffDenied.ok) {
      expect(staffDenied.status).toBe(403);
      expect(staffDenied.error).toBe(COMPLIANCE_STATUS_FORBIDDEN);
    }

    const invoiceUpdate = await updateComplianceStatus(
      admin,
      {
        subjectType: "INVOICE",
        subjectId: draft.data.id,
        status: "UNDER_REVIEW",
      },
      complianceDeps,
    );
    expect(invoiceUpdate.ok).toBe(true);
    if (!invoiceUpdate.ok) {
      throw new Error(invoiceUpdate.error);
    }
    expect(invoiceUpdate.data.status).toBe("UNDER_REVIEW");
    expect(invoiceUpdate.data.previousStatus).toBe("NOT_REVIEWED");
    expect(invoiceUpdate.data.review).not.toBeNull();
    if (invoiceUpdate.data.review) {
      createdReviewIds.push(invoiceUpdate.data.review.id);
    }

    const invoiceRow = await prisma.invoice.findUnique({ where: { id: draft.data.id } });
    expect(invoiceRow?.complianceStatus).toBe("UNDER_REVIEW");

    const payment = await recordManualPayment(
      admin,
      {
        invoiceId: draft.data.id,
        invoiceAmountApplied: "40.00",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-08-24",
      },
      paymentDeps,
    );
    expect(payment.ok).toBe(true);
    if (!payment.ok) {
      throw new Error(payment.error);
    }
    createdPaymentIds.push(payment.data.id);
    expect(payment.data.complianceStatus).toBe("NOT_REVIEWED");

    const paymentStaffDenied = await updateComplianceStatus(
      staff,
      {
        subjectType: "PAYMENT",
        subjectId: payment.data.id,
        status: "FLAGGED",
      },
      complianceDeps,
    );
    expect(paymentStaffDenied.ok).toBe(false);
    if (!paymentStaffDenied.ok) {
      expect(paymentStaffDenied.status).toBe(403);
    }

    const paymentUpdate = await updateComplianceStatus(
      admin,
      {
        subjectType: "PAYMENT",
        subjectId: payment.data.id,
        status: "FLAGGED",
      },
      complianceDeps,
    );
    expect(paymentUpdate.ok).toBe(true);
    if (paymentUpdate.ok && paymentUpdate.data.review) {
      createdReviewIds.push(paymentUpdate.data.review.id);
    }

    const customerUpdate = await updateComplianceStatus(
      admin,
      {
        subjectType: "CUSTOMER",
        subjectId: customer.data.id,
        companyId: company.data.id,
        status: "APPROVED",
      },
      complianceDeps,
    );
    expect(customerUpdate.ok).toBe(true);
    if (customerUpdate.ok && customerUpdate.data.review) {
      createdReviewIds.push(customerUpdate.data.review.id);
    }

    const customerRow = await prisma.customer.findUnique({ where: { id: customer.data.id } });
    expect(customerRow?.complianceStatus).toBe("APPROVED");

    const audits = await prisma.auditLog.findMany({
      where: {
        action: AuditActions.COMPLIANCE_STATUS_UPDATED,
        entityId: { in: [draft.data.id, payment.data.id, customer.data.id] },
      },
    });
    expect(audits.length).toBeGreaterThanOrEqual(3);
  }, 120_000);

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
