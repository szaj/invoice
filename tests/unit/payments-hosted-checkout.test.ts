import { describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import type { RoleCode } from "@/domain/authz/roles";
import type { CurrencyRecord } from "@/domain/currencies/types";
import type { CustomerRecord } from "@/domain/customers/types";
import { FIXED_RATE_MISSING_FOR_CONVERSION } from "@/domain/fixed-rates/types";
import type { CompanyGatewayConfiguration } from "@/domain/gateway-config/types";
import type { InvoiceRecord } from "@/domain/invoices/types";
import { computeConvertedSettlementAmount } from "@/domain/money";
import { PaymentProviderRegistry } from "@/domain/payments/providers/registry";
import type { PaymentWriteInput } from "@/domain/payments/schema";
import {
  PAYMENT_CHECKOUT_METHOD_UNSUPPORTED,
  PAYMENT_CHECKOUT_NO_OUTSTANDING,
  type PaymentRecord,
} from "@/domain/payments/types";
import type { CompanySettlementConfiguration } from "@/domain/settlement/types";
import {
  createHostedCheckout,
  listHostedCheckoutOptions,
  type PaymentServiceDependencies,
} from "@/server/payments/payment-service";
import { FakePaymentAdapter } from "@/server/payments/providers/fake-payment-adapter";
import { createMemoryAuditWriter } from "../helpers/memory-audit-writer";
import { AuditActions } from "@/domain/audit/types";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const STAFF_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADMIN_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CUSTOMER_ID = "eeeeeeee-eeee-4eee-8eee-000000000001";
const INVOICE_ID = "ffffffff-ffff-4fff-8fff-000000000001";
const RATE_VERSION_ID = "99999999-9999-4999-8999-999999999999";

function principal(
  roleCode: RoleCode,
  overrides: Partial<AuthorizationPrincipal> = {},
): AuthorizationPrincipal {
  const userId = roleCode === "STAFF" ? STAFF_ID : ADMIN_ID;
  return {
    userId,
    status: "ACTIVE",
    roleCode,
    assignedCompanyIds: roleCode === "ADMIN" ? [] : [COMPANY_A],
    ...overrides,
  };
}

function invoiceRecord(overrides: Partial<InvoiceRecord> = {}): InvoiceRecord {
  return {
    id: INVOICE_ID,
    companyId: COMPANY_A,
    customerId: CUSTOMER_ID,
    invoiceNumber: "INV-000001",
    invoiceDate: new Date("2026-08-01T00:00:00.000Z"),
    dueDate: new Date("2026-08-31T00:00:00.000Z"),
    currencyCode: "GBP",
    referencePo: null,
    assignedStaffUserId: STAFF_ID,
    status: "ISSUED",
    complianceStatus: "NOT_REVIEWED",
    internalNotes: null,
    customerNotes: null,
    subtotal: "100",
    discountTotal: "0",
    taxTotal: "0",
    invoiceTotal: "100.00",
    confirmedPaidAmount: "0",
    outstandingAmount: "100.00",
    cancellationReason: null,
    cancelledAt: null,
    cancelledByUserId: null,
    createdByUserId: STAFF_ID,
    updatedByUserId: STAFF_ID,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

function customerRecord(): CustomerRecord {
  return {
    id: CUSTOMER_ID,
    displayName: "Acme",
    contactPerson: null,
    customerType: "BUSINESS",
    email: "billing@acme.test",
    phone: null,
    alternatePhone: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    region: null,
    postalCode: null,
    countryCode: null,
    taxRegistrationId: null,
    website: null,
    defaultInvoiceCurrencyCode: null,
    defaultCompanyId: COMPANY_A,
    paymentPreference: null,
    status: "ACTIVE",
    complianceStatus: "NOT_REVIEWED",
    assignedStaffUserId: null,
    internalNotes: null,
    tags: [],
    companyIds: [COMPANY_A],
    createdByUserId: null,
    updatedByUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function currencyRecord(code: string, precision = 2): CurrencyRecord {
  return {
    id: `curr-${code}`,
    code,
    name: code,
    symbol: code,
    decimalPrecision: precision,
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function settlementConfig(stripeEnabled: boolean): CompanySettlementConfiguration {
  const flags = (enabled: readonly string[]) =>
    ["USD", "AED", "GBP"].map((code) => ({
      currencyCode: code,
      name: code,
      globalStatus: "ACTIVE" as const,
      enabled: enabled.includes(code),
      isInitial: code === "USD" || code === "AED",
    }));

  return {
    companyId: COMPANY_A,
    companyDisplayName: "Co A",
    methods: [
      {
        methodCode: "MANUAL",
        methodEnabled: true,
        settlementCurrencies: flags(["USD"]),
        enabledSettlementCurrencyCodes: ["USD"],
      },
      {
        methodCode: "STRIPE",
        methodEnabled: stripeEnabled,
        settlementCurrencies: flags(stripeEnabled ? ["USD"] : []),
        enabledSettlementCurrencyCodes: stripeEnabled ? ["USD"] : [],
      },
      {
        methodCode: "PAYPAL",
        methodEnabled: false,
        settlementCurrencies: flags([]),
        enabledSettlementCurrencyCodes: [],
      },
      {
        methodCode: "BANK_PROCESSOR",
        methodEnabled: true,
        settlementCurrencies: flags(["USD"]),
        enabledSettlementCurrencyCodes: ["USD"],
      },
    ],
  };
}

function gatewayConfig(input: {
  stripeEnabled: boolean;
  stripeCredentials: boolean;
}): CompanyGatewayConfiguration {
  return {
    companyId: COMPANY_A,
    companyDisplayName: "Co A",
    methods: [
      {
        methodCode: "MANUAL",
        methodEnabled: true,
        environment: null,
        credentialsConfigured: false,
        providerConfig: null,
        enabledSettlementCurrencyCodes: ["USD"],
        status: "HEALTHY",
        providerRegistered: true,
      },
      {
        methodCode: "STRIPE",
        methodEnabled: input.stripeEnabled,
        environment: "SANDBOX",
        credentialsConfigured: input.stripeCredentials,
        providerConfig: null,
        enabledSettlementCurrencyCodes: input.stripeEnabled ? ["USD"] : [],
        status: input.stripeEnabled ? "HEALTHY" : "DISABLED",
        providerRegistered: true,
      },
      {
        methodCode: "PAYPAL",
        methodEnabled: false,
        environment: null,
        credentialsConfigured: false,
        providerConfig: null,
        enabledSettlementCurrencyCodes: [],
        status: "DISABLED",
        providerRegistered: true,
      },
      {
        methodCode: "BANK_PROCESSOR",
        methodEnabled: true,
        environment: "SANDBOX",
        credentialsConfigured: true,
        providerConfig: null,
        enabledSettlementCurrencyCodes: ["USD"],
        status: "HEALTHY",
        providerRegistered: false,
      },
    ],
  };
}

function toPaymentRecord(input: PaymentWriteInput, id: string): PaymentRecord {
  const now = new Date("2026-08-24T12:00:00.000Z");
  return {
    id,
    companyId: input.companyId,
    invoiceId: input.invoiceId,
    customerId: input.customerId,
    methodCode: input.methodCode,
    externalTransactionId: input.externalTransactionId,
    status: input.status,
    complianceStatus: "NOT_REVIEWED",
    invoiceCurrencyCode: input.invoiceCurrencyCode,
    invoiceAmountApplied: input.invoiceAmountApplied,
    settlementCurrencyCode: input.settlementCurrencyCode,
    fixedConversionRate: input.fixedConversionRate,
    rateVersionId: input.rateVersionId,
    rateSource: input.rateSource,
    rateEffectiveAt: input.rateEffectiveAt,
    convertedSettlementAmount: input.convertedSettlementAmount,
    processorFeeAmount: input.processorFeeAmount,
    actualReceivedAmount: input.actualReceivedAmount,
    paymentDate: input.paymentDate,
    receivedAt: input.receivedAt,
    source: input.source,
    notes: input.notes,
    createdByUserId: input.createdByUserId,
    confirmedByUserId: input.confirmedByUserId,
    createdAt: now,
    updatedAt: now,
  };
}

function createHostedDeps(seed: {
  stripeEnabled?: boolean;
  stripeCredentials?: boolean;
  missingRate?: boolean;
  adminRate?: string;
  invoices?: InvoiceRecord[];
}): PaymentServiceDependencies & {
  auditWriter: ReturnType<typeof createMemoryAuditWriter>;
  lastProviderConvertedAmount: { value: string | null };
} {
  const stripeEnabled = seed.stripeEnabled ?? true;
  const stripeCredentials = seed.stripeCredentials ?? true;
  const invoices = [...(seed.invoices ?? [invoiceRecord()])];
  const customers = [customerRecord()];
  const currencies = [currencyRecord("USD"), currencyRecord("AED"), currencyRecord("GBP")];
  const payments: PaymentRecord[] = [];
  const auditWriter = createMemoryAuditWriter();
  let nextId = 1;
  const lastProviderConvertedAmount = { value: null as string | null };

  const registry = new PaymentProviderRegistry();
  const fake = new FakePaymentAdapter({ methodCode: "STRIPE", webhookSecret: "test-secret" });
  const originalCreate = fake.createPaymentRequest.bind(fake);
  fake.createPaymentRequest = async (input) => {
    lastProviderConvertedAmount.value = input.convertedSettlementAmount;
    return originalCreate(input);
  };
  registry.register(fake);

  const gateways = gatewayConfig({ stripeEnabled, stripeCredentials });

  return {
    auditWriter,
    lastProviderConvertedAmount,
    now: () => new Date("2026-08-24T15:00:00.000Z"),
    checkoutReturnBaseUrl: "https://app.test",
    providerRegistry: registry,
    enforceTransactionalCompanyScope: async (actor, companyId) => {
      assertCompanyAccess(actor, companyId);
      return { ok: true as const, data: true as const };
    },
    payments: {
      async getPaymentById(id: string) {
        return payments.find((row) => row.id === id) ?? null;
      },
      async getPaymentByExternalTransaction(query) {
        return (
          payments.find(
            (row) =>
              row.companyId === query.companyId &&
              row.methodCode === query.methodCode &&
              row.externalTransactionId === query.externalTransactionId,
          ) ?? null
        );
      },
      async listPayments(filters) {
        return payments.filter(
          (row) =>
            filters.companyIds.includes(row.companyId) &&
            (filters.invoiceId ? row.invoiceId === filters.invoiceId : true),
        );
      },
      async createPayment(input) {
        const created = toPaymentRecord(
          input,
          `00000000-0000-4000-8000-${String(nextId).padStart(12, "0")}`,
        );
        nextId += 1;
        payments.push(created);
        return created;
      },
      async updatePaymentLifecycle() {
        return null;
      },
    },
    invoices: {
      async getInvoiceById(id: string) {
        return invoices.find((row) => row.id === id) ?? null;
      },
      async listInvoices(filters) {
        return invoices.filter((row) => filters.companyIds.includes(row.companyId));
      },
      async updatePaymentAllocation(invoiceId, input) {
        const index = invoices.findIndex((row) => row.id === invoiceId);
        if (index < 0) {
          throw new Error("INVOICE_NOT_FOUND");
        }
        const current = invoices[index]!;
        const updated = {
          ...current,
          confirmedPaidAmount: input.confirmedPaidAmount,
          outstandingAmount: input.outstandingAmount,
          status: input.status,
          updatedAt: new Date(),
        };
        invoices[index] = updated;
        return updated;
      },
    },
    settings: {
      async getSettings() {
        return {
          id: "system",
          reportingCurrencyCode: "USD",
          defaultTimezone: "UTC",
          roundingTolerance: "0.01",
          invoiceNumberIncludeYear: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
    },
    customers: {
      async getCustomerById(id: string) {
        return customers.find((row) => row.id === id) ?? null;
      },
    },
    settlement: {
      async getCompanySettlementConfiguration(companyId: string) {
        if (companyId !== COMPANY_A) {
          return null;
        }
        return settlementConfig(stripeEnabled);
      },
    },
    currencies: {
      async findByCode(code: string) {
        return currencies.find((row) => row.code === code.trim().toUpperCase()) ?? null;
      },
    },
    gatewayConfigs: {
      async getCompanyGatewayConfiguration(companyId: string) {
        if (companyId !== COMPANY_A) {
          return null;
        }
        return gateways;
      },
      async getMethodRow(companyId, methodCode) {
        if (companyId !== COMPANY_A) {
          return null;
        }
        const method = gateways.methods.find((row) => row.methodCode === methodCode);
        return {
          id: "gw-row",
          companyId,
          methodCode,
          enabled: method?.methodEnabled ?? false,
          environment: method?.environment ?? null,
          providerConfig: null,
          credentialsConfigured: method?.credentialsConfigured ?? false,
          envelope: null,
          enabledSettlementCurrencyCodes: method?.enabledSettlementCurrencyCodes ?? [],
        };
      },
    },
    async resolveRate(fromCurrency, toCurrency, at) {
      const from = fromCurrency.trim().toUpperCase();
      const to = toCurrency.trim().toUpperCase();
      if (from === to) {
        return {
          ok: true as const,
          fromCurrency: from,
          toCurrency: to,
          at,
          fixedRate: "1.000000000000",
          rateSource: "same_currency" as const,
          rateVersionId: null,
          versionNo: null,
          validFrom: null,
          validTo: null,
          status: null,
        };
      }
      if (seed.missingRate) {
        return {
          ok: false as const,
          error: FIXED_RATE_MISSING_FOR_CONVERSION,
          fromCurrency: from,
          toCurrency: to,
          at,
        };
      }
      return {
        ok: true as const,
        fromCurrency: from,
        toCurrency: to,
        at,
        fixedRate: seed.adminRate ?? "1.250000000000",
        rateSource: "admin_fixed_rate" as const,
        rateVersionId: RATE_VERSION_ID,
        versionNo: 1,
        validFrom: at,
        validTo: null,
        status: "ACTIVE" as const,
      };
    },
  };
}

describe("hosted checkout (TASK-058)", () => {
  it("creates PENDING payment using Admin fixed rate (not gateway FX)", async () => {
    const deps = createHostedDeps({ adminRate: "1.250000000000" });
    const expected = computeConvertedSettlementAmount({
      invoiceAmountApplied: "100.00",
      invoiceCurrencyCode: "GBP",
      settlementCurrencyCode: "USD",
      fixedConversionRate: "1.250000000000",
      settlementDecimalPrecision: 2,
      processorFee: null,
    });

    const result = await createHostedCheckout(
      principal("ADMIN"),
      {
        invoiceId: INVOICE_ID,
        methodCode: "STRIPE",
        settlementCurrencyCode: "USD",
      },
      deps,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.payment.status).toBe("PENDING");
    expect(result.data.payment.source).toBe("GATEWAY_API");
    expect(result.data.payment.methodCode).toBe("STRIPE");
    expect(result.data.payment.fixedConversionRate).toBe(expected.fixedConversionRateApplied);
    expect(result.data.payment.rateSource).toBe("ADMIN_FIXED_RATE");
    expect(result.data.payment.convertedSettlementAmount).toBe(
      expected.convertedSettlementAmount.amount,
    );
    expect(deps.lastProviderConvertedAmount.value).toBe(expected.convertedSettlementAmount.amount);
    expect(result.data.checkoutUrl).toContain("https://payments.test/checkout/");
    expect(result.data.payment.externalTransactionId).toBeTruthy();
    expect(deps.auditWriter.events.some((e) => e.action === AuditActions.PAYMENT_CREATED)).toBe(
      true,
    );
  });

  it("allows Staff with invoice.create to create checkout (not payment.manual.record)", async () => {
    const deps = createHostedDeps({});
    const result = await createHostedCheckout(
      principal("STAFF"),
      {
        invoiceId: INVOICE_ID,
        methodCode: "STRIPE",
        settlementCurrencyCode: "USD",
      },
      deps,
    );
    expect(result.ok).toBe(true);
  });

  it("omits disabled and bank-processor methods from options", async () => {
    const enabled = createHostedDeps({ stripeEnabled: true, stripeCredentials: true });
    const enabledOptions = await listHostedCheckoutOptions(principal("ADMIN"), INVOICE_ID, enabled);
    expect(enabledOptions.ok).toBe(true);
    if (enabledOptions.ok) {
      expect(enabledOptions.data.map((row) => row.methodCode)).toEqual(["STRIPE"]);
      expect(enabledOptions.data.some((row) => row.methodCode === "BANK_PROCESSOR")).toBe(false);
    }

    const disabled = createHostedDeps({ stripeEnabled: false, stripeCredentials: true });
    const disabledOptions = await listHostedCheckoutOptions(
      principal("ADMIN"),
      INVOICE_ID,
      disabled,
    );
    expect(disabledOptions.ok).toBe(true);
    if (disabledOptions.ok) {
      expect(disabledOptions.data).toEqual([]);
    }
  });

  it("rejects disabled gateway on create", async () => {
    const deps = createHostedDeps({ stripeEnabled: false });
    const result = await createHostedCheckout(
      principal("ADMIN"),
      {
        invoiceId: INVOICE_ID,
        methodCode: "STRIPE",
        settlementCurrencyCode: "USD",
      },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(PAYMENT_CHECKOUT_METHOD_UNSUPPORTED);
    }
  });

  it("rejects when there is no outstanding balance", async () => {
    const deps = createHostedDeps({
      invoices: [invoiceRecord({ invoiceTotal: "0.00", outstandingAmount: "0.00" })],
    });
    const result = await createHostedCheckout(
      principal("ADMIN"),
      {
        invoiceId: INVOICE_ID,
        methodCode: "STRIPE",
        settlementCurrencyCode: "USD",
      },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(PAYMENT_CHECKOUT_NO_OUTSTANDING);
    }
  });

  it("denies company isolation for another company invoice", async () => {
    const deps = createHostedDeps({
      invoices: [invoiceRecord({ companyId: COMPANY_B })],
    });
    const result = await createHostedCheckout(
      principal("STAFF"),
      {
        invoiceId: INVOICE_ID,
        methodCode: "STRIPE",
        settlementCurrencyCode: "USD",
      },
      deps,
    );
    expect(result.ok).toBe(false);
  });
});
