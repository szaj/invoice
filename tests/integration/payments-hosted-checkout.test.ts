import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { PaymentProviderRegistry } from "@/domain/payments/providers/registry";
import { updateCompanyBranding } from "@/server/companies/branding-service";
import { PrismaCompanyBrandingStore } from "@/server/companies/branding-repository";
import { createCompany } from "@/server/companies/company-service";
import { PrismaCompanyStore } from "@/server/companies/company-repository";
import { updateCompanyCurrencyConfiguration } from "@/server/companies/company-currency-service";
import { PrismaCompanyCurrencyStore } from "@/server/companies/company-currency-repository";
import { createCustomer } from "@/server/customers/customer-service";
import { PrismaCustomerStore } from "@/server/customers/customer-repository";
import {
  getCompanyGatewayConfiguration,
  replaceGatewayMethodCredentials,
  updateGatewayMethodConfiguration,
} from "@/server/gateway-config/gateway-config-service";
import { PrismaGatewayConfigStore } from "@/server/gateway-config/gateway-config-repository";
import { GatewayCredentialService } from "@/server/gateway-credentials/gateway-credential-service";
import { createDraftInvoice } from "@/server/invoices/invoice-draft-service";
import { issueInvoice } from "@/server/invoices/invoice-lifecycle-service";
import { PrismaInvoiceNumberStore } from "@/server/invoices/invoice-number-repository";
import { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";
import { replaceDraftInvoiceLineItems } from "@/server/invoices/invoice-line-item-service";
import { createHostedCheckout, listHostedCheckoutOptions } from "@/server/payments/payment-service";
import { PrismaPaymentStore } from "@/server/payments/payment-repository";
import { FakePaymentAdapter } from "@/server/payments/providers/fake-payment-adapter";
import { MemoryStorageService } from "@/server/storage/memory-storage";
import { updatePaymentMethodSettlementConfiguration } from "@/server/settlement/settlement-service";
import { PrismaSettlementConfigStore } from "@/server/settlement/settlement-repository";
import { randomBytes } from "node:crypto";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("hosted checkout integration (TASK-058)", () => {
  const createdPaymentIds: string[] = [];
  const createdInvoiceIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdCompanyIds: string[] = [];
  const kek = randomBytes(32).toString("base64");
  const credentialService = GatewayCredentialService.fromEnv({
    GATEWAY_CREDENTIALS_KEY_VERSION: "1",
    GATEWAY_CREDENTIALS_KEY_V1: kek,
  });
  const gatewayDeps = {
    store: new PrismaGatewayConfigStore(),
    credentialService,
  };

  afterAll(async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    if (createdPaymentIds.length > 0) {
      await prisma.payment.deleteMany({ where: { id: { in: createdPaymentIds } } });
    }
    if (createdInvoiceIds.length > 0) {
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
  });

  it("creates PENDING payment for hosted checkout and omits disabled gateway from options", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const adminId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee58";
    const admin: AuthorizationPrincipal = {
      userId: adminId,
      status: "ACTIVE",
      roleCode: "ADMIN",
    };

    await prisma.user.upsert({
      where: { id: adminId },
      create: {
        id: adminId,
        name: "TASK-058 Admin",
        email: `task058-admin-${Date.now()}@example.com`,
        supabaseAuthUserId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee59",
        status: "ACTIVE",
      },
      update: {},
    });

    const company = await createCompany(
      admin,
      {
        displayName: `TASK-058 Co ${Date.now()}`,
      },
      { store: new PrismaCompanyStore() },
    );
    expect(company.ok).toBe(true);
    if (!company.ok) {
      return;
    }
    createdCompanyIds.push(company.data.id);

    await updateCompanyBranding(
      admin,
      company.data.id,
      {
        email: null,
        phone: null,
        website: null,
        invoicePrefix: "H8-",
        termsAndConditions: null,
        emailTemplateReference: null,
      },
      {
        store: new PrismaCompanyBrandingStore(),
        storage: new MemoryStorageService(),
      },
    );

    const usd = await prisma.currency.findUniqueOrThrow({ where: { code: "USD" } });
    await updateCompanyCurrencyConfiguration(
      admin,
      company.data.id,
      { enabledCurrencyIds: [usd.id], defaultCurrencyId: usd.id },
      { store: new PrismaCompanyCurrencyStore() },
    );

    const settlement = await updatePaymentMethodSettlementConfiguration(
      admin,
      company.data.id,
      "STRIPE",
      { methodEnabled: true, enabledSettlementCurrencyCodes: ["USD"] },
      { store: new PrismaSettlementConfigStore() },
    );
    expect(settlement.ok).toBe(true);

    const enabled = await updateGatewayMethodConfiguration(
      admin,
      company.data.id,
      "STRIPE",
      { methodEnabled: true, environment: "SANDBOX" },
      gatewayDeps,
    );
    expect(enabled.ok).toBe(true);
    const creds = await replaceGatewayMethodCredentials(
      admin,
      company.data.id,
      "STRIPE",
      {
        credentials: {
          apiSecret: "sk_test_task058_hosted_checkout",
          webhookSecret: "whsec_task058",
        },
      },
      gatewayDeps,
    );
    expect(creds.ok).toBe(true);

    const customer = await createCustomer(
      admin,
      {
        displayName: `TASK-058 Customer ${Date.now()}`,
        customerType: "BUSINESS",
        companyIds: [company.data.id],
        defaultCompanyId: company.data.id,
        acknowledgeDuplicates: true,
      },
      { store: new PrismaCustomerStore() },
    );
    expect(customer.ok).toBe(true);
    if (!customer.ok) {
      return;
    }
    createdCustomerIds.push(customer.data.id);

    const draft = await createDraftInvoice(
      admin,
      {
        companyId: company.data.id,
        customerId: customer.data.id,
        currencyCode: "USD",
        invoiceDate: "2026-08-01",
        dueDate: "2026-08-31",
      },
      {
        store: new PrismaInvoiceStore(),
        customerStore: new PrismaCustomerStore(),
      },
    );
    expect(draft.ok).toBe(true);
    if (!draft.ok) {
      return;
    }
    createdInvoiceIds.push(draft.data.id);

    const lines = await replaceDraftInvoiceLineItems(
      admin,
      draft.data.id,
      {
        lineItems: [
          {
            description: "Hosted checkout line",
            quantity: "1",
            unitRate: "50.00",
          },
        ],
      },
      {
        store: new PrismaInvoiceStore(),
        currencyStore: new (
          await import("@/server/currencies/currency-repository")
        ).PrismaCurrencyStore(),
      },
    );
    expect(lines.ok).toBe(true);

    const issued = await issueInvoice(admin, draft.data.id, {
      invoices: new PrismaInvoiceStore(),
      numbers: new PrismaInvoiceNumberStore(),
      skipPdfGeneration: true,
    });
    expect(issued.ok).toBe(true);

    const registry = new PaymentProviderRegistry();
    registry.register(new FakePaymentAdapter({ methodCode: "STRIPE", webhookSecret: "x" }));

    const paymentDeps = {
      payments: new PrismaPaymentStore(),
      invoices: new PrismaInvoiceStore(),
      customers: new PrismaCustomerStore(),
      settlement: new PrismaSettlementConfigStore(),
      currencies: new (
        await import("@/server/currencies/currency-repository")
      ).PrismaCurrencyStore(),
      gatewayConfigs: new PrismaGatewayConfigStore(),
      providerRegistry: registry,
      checkoutReturnBaseUrl: "https://app.test",
      enforceTransactionalCompanyScope: async () => ({ ok: true as const, data: true as const }),
    };

    const optionsBeforeDisable = await listHostedCheckoutOptions(admin, draft.data.id, paymentDeps);
    expect(optionsBeforeDisable.ok).toBe(true);
    if (optionsBeforeDisable.ok) {
      expect(optionsBeforeDisable.data.map((row) => row.methodCode)).toContain("STRIPE");
    }

    const created = await createHostedCheckout(
      admin,
      {
        invoiceId: draft.data.id,
        methodCode: "STRIPE",
        settlementCurrencyCode: "USD",
      },
      paymentDeps,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    createdPaymentIds.push(created.data.payment.id);
    expect(created.data.payment.status).toBe("PENDING");
    expect(created.data.payment.source).toBe("GATEWAY_API");
    expect(created.data.payment.externalTransactionId).toBeTruthy();
    expect(created.data.checkoutUrl).toContain("/checkout/");
    expect(created.data.payment.convertedSettlementAmount).toBe("50");
    expect(created.data.payment.fixedConversionRate).toBe("1");

    const disabled = await updateGatewayMethodConfiguration(
      admin,
      company.data.id,
      "STRIPE",
      { methodEnabled: false, environment: "SANDBOX" },
      gatewayDeps,
    );
    expect(disabled.ok).toBe(true);
    const gateways = await getCompanyGatewayConfiguration(admin, company.data.id, gatewayDeps);
    expect(gateways.ok).toBe(true);
    if (gateways.ok) {
      const stripe = gateways.data.methods.find((row) => row.methodCode === "STRIPE");
      expect(stripe?.methodEnabled).toBe(false);
    }

    const optionsAfterDisable = await listHostedCheckoutOptions(admin, draft.data.id, paymentDeps);
    expect(optionsAfterDisable.ok).toBe(true);
    if (optionsAfterDisable.ok) {
      expect(optionsAfterDisable.data.map((row) => row.methodCode)).not.toContain("STRIPE");
    }
  }, 120_000);
});
