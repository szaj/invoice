import { describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import type { RoleCode } from "@/domain/authz/roles";
import type { CurrencyRecord } from "@/domain/currencies/types";
import type { CustomerRecord } from "@/domain/customers/types";
import { FIXED_RATE_MISSING_FOR_CONVERSION } from "@/domain/fixed-rates/types";
import type { InvoiceRecord } from "@/domain/invoices/types";
import {
  assertConfirmedFinancialFieldsUnchanged,
  assertPaymentFinancialFieldsMutable,
} from "@/domain/payments/invariants";
import type { PaymentWriteInput } from "@/domain/payments/schema";
import { canTransitionPaymentStatus } from "@/domain/payments/transitions";
import {
  PAYMENT_AMOUNT_NOT_POSITIVE,
  PAYMENT_COMPANY_SCOPE_REQUIRED,
  PAYMENT_CONFIRMED_IMMUTABLE,
  PAYMENT_EXCEEDS_OPEN_BALANCE,
  PAYMENT_ILLEGAL_TRANSITION,
  PAYMENT_INVOICE_NOT_PAYABLE,
  PAYMENT_RECORD_FORBIDDEN,
  type PaymentRecord,
} from "@/domain/payments/types";
import {
  SETTLEMENT_CURRENCY_NOT_ENABLED,
  type CompanySettlementConfiguration,
} from "@/domain/settlement/types";
import {
  confirmPayment,
  createPendingPayment,
  failPayment,
  getPayment,
  listPayments,
  recordManualPayment,
  type PaymentServiceDependencies,
} from "@/server/payments/payment-service";
import { createMemoryAuditWriter } from "../helpers/memory-audit-writer";
import { AuditActions } from "@/domain/audit/types";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const STAFF_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADMIN_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const COMPLIANCE_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CUSTOMER_ID = "eeeeeeee-eeee-4eee-8eee-000000000001";
const INVOICE_ID = "ffffffff-ffff-4fff-8fff-000000000001";
const RATE_VERSION_ID = "99999999-9999-4999-8999-999999999999";

function principal(
  roleCode: RoleCode,
  overrides: Partial<AuthorizationPrincipal> = {},
): AuthorizationPrincipal {
  const userId =
    roleCode === "STAFF" ? STAFF_ID : roleCode === "COMPLIANCE" ? COMPLIANCE_ID : ADMIN_ID;
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
    currencyCode: "USD",
    referencePo: null,
    assignedStaffUserId: STAFF_ID,
    status: "ISSUED",
    complianceStatus: "NOT_REVIEWED",
    internalNotes: null,
    customerNotes: null,
    subtotal: "100",
    discountTotal: "0",
    taxTotal: "0",
    invoiceTotal: "100",
    confirmedPaidAmount: "0",
    outstandingAmount: "100",
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

function customerRecord(overrides: Partial<CustomerRecord> = {}): CustomerRecord {
  return {
    id: CUSTOMER_ID,
    displayName: "Acme",
    contactPerson: null,
    customerType: "BUSINESS",
    email: null,
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
    assignedStaffUserId: null,
    internalNotes: null,
    tags: [],
    companyIds: [COMPANY_A],
    createdByUserId: null,
    updatedByUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function currencyRecord(code: string, overrides: Partial<CurrencyRecord> = {}): CurrencyRecord {
  return {
    id: `curr-${code}`,
    code,
    name: code,
    symbol: code,
    decimalPrecision: 2,
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function settlementConfig(): CompanySettlementConfiguration {
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
        methodEnabled: false,
        settlementCurrencies: flags([]),
        enabledSettlementCurrencyCodes: [],
      },
      {
        methodCode: "PAYPAL",
        methodEnabled: false,
        settlementCurrencies: flags([]),
        enabledSettlementCurrencyCodes: [],
      },
      {
        methodCode: "BANK_PROCESSOR",
        methodEnabled: false,
        settlementCurrencies: flags([]),
        enabledSettlementCurrencyCodes: [],
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

function createDeps(seed: {
  invoices?: InvoiceRecord[];
  customers?: CustomerRecord[];
  currencies?: CurrencyRecord[];
  missingRate?: boolean;
  gbpUsdRate?: string;
  existingPayments?: PaymentRecord[];
  rateState?: { gbpUsdRate: string; versionId: string; validFrom: Date };
}): PaymentServiceDependencies & { auditWriter: ReturnType<typeof createMemoryAuditWriter> } {
  const invoices = [...(seed.invoices ?? [invoiceRecord()])];
  const customers = [...(seed.customers ?? [customerRecord()])];
  const currencies = [
    ...(seed.currencies ?? [currencyRecord("USD"), currencyRecord("AED"), currencyRecord("GBP")]),
  ];
  const payments: PaymentRecord[] = [...(seed.existingPayments ?? [])];
  const auditWriter = createMemoryAuditWriter();
  let nextId = 1;

  return {
    auditWriter,
    now: () => new Date("2026-08-24T15:00:00.000Z"),
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
            (filters.invoiceId ? row.invoiceId === filters.invoiceId : true) &&
            (filters.customerId ? row.customerId === filters.customerId : true) &&
            (filters.status ? row.status === filters.status : true),
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
      async updatePaymentLifecycle(id, expectedStatus, patch) {
        const index = payments.findIndex((row) => row.id === id && row.status === expectedStatus);
        if (index < 0) {
          return null;
        }
        const current = payments[index]!;
        const updated: PaymentRecord = {
          ...current,
          status: patch.status,
          receivedAt: patch.receivedAt !== undefined ? patch.receivedAt : current.receivedAt,
          confirmedByUserId:
            patch.confirmedByUserId !== undefined
              ? patch.confirmedByUserId
              : current.confirmedByUserId,
          rateEffectiveAt:
            patch.rateEffectiveAt !== undefined ? patch.rateEffectiveAt : current.rateEffectiveAt,
          rateVersionId:
            patch.rateVersionId !== undefined ? patch.rateVersionId : current.rateVersionId,
          updatedAt: new Date("2026-08-24T15:00:00.000Z"),
        };
        payments[index] = updated;
        return updated;
      },
    },
    invoices: {
      async getInvoiceById(id: string) {
        return invoices.find((row) => row.id === id) ?? null;
      },
      async listInvoices(filters) {
        return invoices.filter((row) => filters.companyIds.includes(row.companyId));
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
        return settlementConfig();
      },
    },
    currencies: {
      async findByCode(code: string) {
        return currencies.find((row) => row.code === code.trim().toUpperCase()) ?? null;
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
        fixedRate: seed.rateState?.gbpUsdRate ?? seed.gbpUsdRate ?? "1.250000000000",
        rateSource: "admin_fixed_rate" as const,
        rateVersionId: seed.rateState?.versionId ?? RATE_VERSION_ID,
        versionNo: 1,
        validFrom: seed.rateState?.validFrom ?? at,
        validTo: null,
        status: "ACTIVE" as const,
      };
    },
  };
}

describe("payment status transitions (TASK-045)", () => {
  it("allows pending to successful or failed, and rejects all other changes", () => {
    expect(canTransitionPaymentStatus("PENDING", "SUCCESSFUL")).toBe(true);
    expect(canTransitionPaymentStatus("PENDING", "FAILED")).toBe(true);
    expect(canTransitionPaymentStatus("SUCCESSFUL", "FAILED")).toBe(false);
    expect(canTransitionPaymentStatus("SUCCESSFUL", "PENDING")).toBe(false);
    expect(canTransitionPaymentStatus("FAILED", "SUCCESSFUL")).toBe(false);
    expect(canTransitionPaymentStatus("SUCCESSFUL", "SUCCESSFUL")).toBe(false);
  });
});

describe("payment service (TASK-045)", () => {
  it("creates a pending payment, confirms it, and locks financial fields", async () => {
    const deps = createDeps({});
    const admin = principal("ADMIN");

    const pending = await createPendingPayment(
      admin,
      {
        invoiceId: INVOICE_ID,
        methodCode: "MANUAL",
        invoiceAmountApplied: "40.00",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-08-24",
        processorFeeAmount: "1.50",
      },
      deps,
    );
    expect(pending.ok).toBe(true);
    if (!pending.ok) {
      throw new Error(pending.error);
    }
    expect(pending.data.status).toBe("PENDING");
    expect(pending.data.companyId).toBe(COMPANY_A);
    expect(pending.data.customerId).toBe(CUSTOMER_ID);
    expect(pending.data.invoiceCurrencyCode).toBe("USD");
    expect(pending.data.fixedConversionRate).toBe("1");
    expect(pending.data.rateSource).toBe("SAME_CURRENCY");
    expect(pending.data.convertedSettlementAmount).toBe("40");
    expect(pending.data.processorFeeAmount).toBe("1.5");
    expect(pending.data.convertedSettlementAmount).not.toBe("38.5");
    expect(pending.data.rateSource).toBe("SAME_CURRENCY");
    expect(pending.data.rateVersionId).toBeNull();
    expect(pending.data.rateEffectiveAt?.toISOString()).toBe("2026-08-24T00:00:00.000Z");

    const confirmed = await confirmPayment(admin, pending.data.id, deps);
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) {
      throw new Error(confirmed.error);
    }
    expect(confirmed.data.status).toBe("SUCCESSFUL");
    expect(confirmed.data.invoiceAmountApplied).toBe(pending.data.invoiceAmountApplied);
    expect(confirmed.data.fixedConversionRate).toBe(pending.data.fixedConversionRate);
    expect(confirmed.data.convertedSettlementAmount).toBe(pending.data.convertedSettlementAmount);
    expect(confirmed.data.processorFeeAmount).toBe(pending.data.processorFeeAmount);
    expect(confirmed.data.rateEffectiveAt?.toISOString()).toBe(
      pending.data.rateEffectiveAt?.toISOString(),
    );
    expect(confirmed.data.confirmedByUserId).toBe(ADMIN_ID);

    expect(() => assertPaymentFinancialFieldsMutable(confirmed.data.status)).toThrow(
      PAYMENT_CONFIRMED_IMMUTABLE,
    );
    expect(() =>
      assertConfirmedFinancialFieldsUnchanged(confirmed.data, {
        invoiceAmountApplied: "99.00",
      }),
    ).toThrow(PAYMENT_CONFIRMED_IMMUTABLE);

    const again = await confirmPayment(admin, pending.data.id, deps);
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.status).toBe(400);
      expect(again.error).toBe(PAYMENT_ILLEGAL_TRANSITION);
    }

    expect(deps.auditWriter.events.map((event) => event.action)).toEqual([
      AuditActions.PAYMENT_CREATED,
      AuditActions.PAYMENT_CONFIRMED,
    ]);
  });

  it("computes converted settlement from the Admin fixed rate and excludes fee", async () => {
    const deps = createDeps({
      invoices: [invoiceRecord({ currencyCode: "GBP" })],
    });
    const pending = await createPendingPayment(
      principal("ADMIN"),
      {
        invoiceId: INVOICE_ID,
        methodCode: "MANUAL",
        invoiceAmountApplied: "100.00",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-08-24",
        processorFeeAmount: "9.99",
      },
      deps,
    );
    expect(pending.ok).toBe(true);
    if (!pending.ok) {
      throw new Error(pending.error);
    }
    expect(pending.data.fixedConversionRate).toBe("1.25");
    expect(pending.data.rateSource).toBe("ADMIN_FIXED_RATE");
    expect(pending.data.rateVersionId).toBe(RATE_VERSION_ID);
    expect(pending.data.rateEffectiveAt?.toISOString()).toBe("2026-08-24T00:00:00.000Z");
    expect(pending.data.convertedSettlementAmount).toBe("125");
    expect(pending.data.processorFeeAmount).toBe("9.99");
  });

  it("blocks cross-currency create when no Admin fixed rate exists", async () => {
    const deps = createDeps({
      invoices: [invoiceRecord({ currencyCode: "GBP" })],
      missingRate: true,
    });
    const result = await createPendingPayment(
      principal("ADMIN"),
      {
        invoiceId: INVOICE_ID,
        methodCode: "MANUAL",
        invoiceAmountApplied: "10.00",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-08-24",
      },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toBe(FIXED_RATE_MISSING_FOR_CONVERSION);
    }
  });

  it("rejects draft invoices, zero amounts, and non-enabled settlement currencies", async () => {
    const draftDeps = createDeps({ invoices: [invoiceRecord({ status: "DRAFT" })] });
    const draft = await createPendingPayment(
      principal("ADMIN"),
      {
        invoiceId: INVOICE_ID,
        methodCode: "MANUAL",
        invoiceAmountApplied: "10.00",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-08-24",
      },
      draftDeps,
    );
    expect(draft.ok).toBe(false);
    if (!draft.ok) {
      expect(draft.error).toBe(PAYMENT_INVOICE_NOT_PAYABLE);
    }

    const zero = await createPendingPayment(
      principal("ADMIN"),
      {
        invoiceId: INVOICE_ID,
        methodCode: "MANUAL",
        invoiceAmountApplied: "0",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-08-24",
      },
      createDeps({}),
    );
    expect(zero.ok).toBe(false);
    if (!zero.ok) {
      expect(zero.error).toBe(PAYMENT_AMOUNT_NOT_POSITIVE);
    }

    const settlement = await createPendingPayment(
      principal("ADMIN"),
      {
        invoiceId: INVOICE_ID,
        methodCode: "MANUAL",
        invoiceAmountApplied: "10.00",
        settlementCurrencyCode: "AED",
        paymentDate: "2026-08-24",
      },
      createDeps({}),
    );
    expect(settlement.ok).toBe(false);
    if (!settlement.ok) {
      expect(settlement.error).toBe(SETTLEMENT_CURRENCY_NOT_ENABLED);
    }
  });

  it("denies Staff create/confirm/fail and confirmed-field modification", async () => {
    const deps = createDeps({});
    const staff = principal("STAFF");
    const admin = principal("ADMIN");

    const staffCreate = await createPendingPayment(
      staff,
      {
        invoiceId: INVOICE_ID,
        methodCode: "MANUAL",
        invoiceAmountApplied: "10.00",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-08-24",
      },
      deps,
    );
    expect(staffCreate.ok).toBe(false);
    if (!staffCreate.ok) {
      expect(staffCreate.status).toBe(403);
      expect(staffCreate.error).toBe(PAYMENT_RECORD_FORBIDDEN);
    }

    const pending = await createPendingPayment(
      admin,
      {
        invoiceId: INVOICE_ID,
        methodCode: "MANUAL",
        invoiceAmountApplied: "10.00",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-08-24",
      },
      deps,
    );
    expect(pending.ok).toBe(true);
    if (!pending.ok) {
      throw new Error(pending.error);
    }

    const staffConfirm = await confirmPayment(staff, pending.data.id, deps);
    expect(staffConfirm.ok).toBe(false);
    if (!staffConfirm.ok) {
      expect(staffConfirm.status).toBe(403);
      expect(staffConfirm.error).toBe(PAYMENT_RECORD_FORBIDDEN);
    }

    const confirmed = await confirmPayment(admin, pending.data.id, deps);
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) {
      throw new Error(confirmed.error);
    }

    const staffFail = await failPayment(staff, confirmed.data.id, deps);
    expect(staffFail.ok).toBe(false);
    if (!staffFail.ok) {
      expect(staffFail.status).toBe(403);
      expect(staffFail.error).toBe(PAYMENT_RECORD_FORBIDDEN);
    }

    expect(() =>
      assertConfirmedFinancialFieldsUnchanged(confirmed.data, {
        convertedSettlementAmount: "1",
      }),
    ).toThrow(PAYMENT_CONFIRMED_IMMUTABLE);
  });

  it("lists payments by assigned company and hides unassigned company rows from Staff", async () => {
    const deps = createDeps({});
    const admin = principal("ADMIN");
    const created = await createPendingPayment(
      admin,
      {
        invoiceId: INVOICE_ID,
        methodCode: "MANUAL",
        invoiceAmountApplied: "10.00",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-08-24",
      },
      deps,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error(created.error);
    }

    const adminList = await listPayments(admin, { companyId: COMPANY_A }, deps);
    expect(adminList.ok).toBe(true);
    if (!adminList.ok) {
      throw new Error(adminList.error);
    }
    expect(adminList.data).toHaveLength(1);

    const adminAllCompanies = await listPayments(admin, {}, deps);
    expect(adminAllCompanies.ok).toBe(false);
    if (!adminAllCompanies.ok) {
      expect(adminAllCompanies.error).toBe(PAYMENT_COMPANY_SCOPE_REQUIRED);
    }

    const staffList = await listPayments(principal("STAFF"), { companyId: COMPANY_A }, deps);
    expect(staffList.ok).toBe(true);
    if (!staffList.ok) {
      throw new Error(staffList.error);
    }
    expect(staffList.data).toHaveLength(1);

    const staffDenied = await listPayments(principal("STAFF"), { companyId: COMPANY_B }, deps);
    expect(staffDenied.ok).toBe(false);
    if (!staffDenied.ok) {
      expect(staffDenied.status).toBe(403);
      expect(staffDenied.error).toBe(GENERIC_FORBIDDEN);
    }

    const detail = await getPayment(principal("STAFF"), created.data.id, deps);
    expect(detail.ok).toBe(true);
  });

  it("marks pending payments failed without mutating financial fields", async () => {
    const deps = createDeps({});
    const admin = principal("ADMIN");
    const pending = await createPendingPayment(
      admin,
      {
        invoiceId: INVOICE_ID,
        methodCode: "MANUAL",
        invoiceAmountApplied: "10.00",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-08-24",
      },
      deps,
    );
    expect(pending.ok).toBe(true);
    if (!pending.ok) {
      throw new Error(pending.error);
    }

    const failed = await failPayment(admin, pending.data.id, deps);
    expect(failed.ok).toBe(true);
    if (!failed.ok) {
      throw new Error(failed.error);
    }
    expect(failed.data.status).toBe("FAILED");
    expect(failed.data.invoiceAmountApplied).toBe(pending.data.invoiceAmountApplied);
    expect(failed.data.convertedSettlementAmount).toBe(pending.data.convertedSettlementAmount);

    const confirmFailed = await confirmPayment(admin, pending.data.id, deps);
    expect(confirmFailed.ok).toBe(false);
    if (!confirmFailed.ok) {
      expect(confirmFailed.error).toBe(PAYMENT_ILLEGAL_TRANSITION);
    }
    expect(
      deps.auditWriter.events.some((event) => event.action === AuditActions.PAYMENT_FAILED),
    ).toBe(true);
  });
});

describe("payment settlement snapshot (TASK-046)", () => {
  const RATE_VERSION_V2 = "88888888-8888-4888-8888-888888888888";
  const INCOMPLETE_PAYMENT_ID = "00000000-0000-4000-8000-000000000099";

  function incompleteCrossCurrencyPayment(): PaymentRecord {
    const paymentDate = new Date("2026-08-24T00:00:00.000Z");
    return {
      id: INCOMPLETE_PAYMENT_ID,
      companyId: COMPANY_A,
      invoiceId: INVOICE_ID,
      customerId: CUSTOMER_ID,
      methodCode: "MANUAL",
      externalTransactionId: null,
      status: "PENDING",
      invoiceCurrencyCode: "GBP",
      invoiceAmountApplied: "100",
      settlementCurrencyCode: "USD",
      fixedConversionRate: "1.25",
      rateVersionId: null,
      rateSource: "ADMIN_FIXED_RATE",
      rateEffectiveAt: null,
      convertedSettlementAmount: "125",
      processorFeeAmount: "9.99",
      actualReceivedAmount: null,
      paymentDate,
      receivedAt: null,
      source: "MANUAL",
      notes: null,
      createdByUserId: ADMIN_ID,
      confirmedByUserId: null,
      createdAt: paymentDate,
      updatedAt: paymentDate,
    };
  }

  it("does not recalculate a stored snapshot when a later Admin rate version exists", async () => {
    const rateState = {
      gbpUsdRate: "3.670000000000",
      versionId: RATE_VERSION_ID,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
    };
    const deps = createDeps({
      invoices: [invoiceRecord({ currencyCode: "GBP" })],
      rateState,
    });
    const admin = principal("ADMIN");

    const pending = await createPendingPayment(
      admin,
      {
        invoiceId: INVOICE_ID,
        methodCode: "MANUAL",
        invoiceAmountApplied: "100.00",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-01-15",
        processorFeeAmount: "4.00",
      },
      deps,
    );
    expect(pending.ok).toBe(true);
    if (!pending.ok) {
      throw new Error(pending.error);
    }
    expect(pending.data.fixedConversionRate).toBe("3.67");
    expect(pending.data.rateVersionId).toBe(RATE_VERSION_ID);
    expect(pending.data.rateEffectiveAt?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(pending.data.convertedSettlementAmount).toBe("367");
    expect(pending.data.processorFeeAmount).toBe("4");
    expect(pending.data.convertedSettlementAmount).not.toBe("363");

    rateState.gbpUsdRate = "3.680000000000";
    rateState.versionId = RATE_VERSION_V2;
    rateState.validFrom = new Date("2026-07-01T00:00:00.000Z");

    const confirmed = await confirmPayment(admin, pending.data.id, deps);
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) {
      throw new Error(confirmed.error);
    }
    expect(confirmed.data.status).toBe("SUCCESSFUL");
    expect(confirmed.data.fixedConversionRate).toBe("3.67");
    expect(confirmed.data.rateVersionId).toBe(RATE_VERSION_ID);
    expect(confirmed.data.rateEffectiveAt?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(confirmed.data.convertedSettlementAmount).toBe("367");
    expect(confirmed.data.processorFeeAmount).toBe("4");

    expect(() =>
      assertConfirmedFinancialFieldsUnchanged(confirmed.data, {
        rateEffectiveAt: new Date("2026-07-01T00:00:00.000Z"),
        fixedConversionRate: "3.68",
        rateVersionId: RATE_VERSION_V2,
      }),
    ).toThrow(PAYMENT_CONFIRMED_IMMUTABLE);
  });

  it("blocks cross-currency confirm when the Admin fixed rate is missing", async () => {
    const deps = createDeps({
      invoices: [invoiceRecord({ currencyCode: "GBP" })],
      missingRate: true,
      existingPayments: [incompleteCrossCurrencyPayment()],
    });
    const result = await confirmPayment(principal("ADMIN"), INCOMPLETE_PAYMENT_ID, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toBe(FIXED_RATE_MISSING_FOR_CONVERSION);
    }
  });

  it("completes an incomplete snapshot on confirm without replacing stored rate or fee", async () => {
    const deps = createDeps({
      invoices: [invoiceRecord({ currencyCode: "GBP" })],
      gbpUsdRate: "1.250000000000",
      existingPayments: [incompleteCrossCurrencyPayment()],
    });
    const confirmed = await confirmPayment(principal("ADMIN"), INCOMPLETE_PAYMENT_ID, deps);
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) {
      throw new Error(confirmed.error);
    }
    expect(confirmed.data.fixedConversionRate).toBe("1.25");
    expect(confirmed.data.convertedSettlementAmount).toBe("125");
    expect(confirmed.data.processorFeeAmount).toBe("9.99");
    expect(confirmed.data.rateVersionId).toBe(RATE_VERSION_ID);
    expect(confirmed.data.rateEffectiveAt).not.toBeNull();
  });
});

describe("payment merchant fee reconciliation (TASK-047)", () => {
  it("does not auto-derive actual received and does not let fee change settlement or applied amount", async () => {
    const deps = createDeps({
      invoices: [invoiceRecord({ currencyCode: "GBP", invoiceTotal: "200" })],
    });
    const admin = principal("ADMIN");

    const omittedActual = await createPendingPayment(
      admin,
      {
        invoiceId: INVOICE_ID,
        methodCode: "MANUAL",
        invoiceAmountApplied: "100.00",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-08-24",
        processorFeeAmount: "9.99",
      },
      deps,
    );
    expect(omittedActual.ok).toBe(true);
    if (!omittedActual.ok) {
      throw new Error(omittedActual.error);
    }
    expect(omittedActual.data.convertedSettlementAmount).toBe("125");
    expect(omittedActual.data.invoiceAmountApplied).toBe("100");
    expect(omittedActual.data.processorFeeAmount).toBe("9.99");
    expect(omittedActual.data.actualReceivedAmount).toBeNull();
    expect(omittedActual.data.convertedSettlementAmount).not.toBe("115.01");

    const withActual = await createPendingPayment(
      admin,
      {
        invoiceId: INVOICE_ID,
        methodCode: "MANUAL",
        invoiceAmountApplied: "100.00",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-08-24",
        processorFeeAmount: "9.99",
        actualReceivedAmount: "120.00",
      },
      deps,
    );
    expect(withActual.ok).toBe(true);
    if (!withActual.ok) {
      throw new Error(withActual.error);
    }
    expect(withActual.data.convertedSettlementAmount).toBe("125");
    expect(withActual.data.actualReceivedAmount).toBe("120");
    expect(withActual.data.actualReceivedAmount).not.toBe("115.01");

    const confirmed = await confirmPayment(admin, withActual.data.id, deps);
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) {
      throw new Error(confirmed.error);
    }
    expect(confirmed.data.invoiceAmountApplied).toBe("100");
    expect(confirmed.data.convertedSettlementAmount).toBe("125");
    expect(confirmed.data.fixedConversionRate).toBe("1.25");
    expect(confirmed.data.processorFeeAmount).toBe("9.99");
    expect(confirmed.data.actualReceivedAmount).toBe("120");

    const negativeFee = await createPendingPayment(
      admin,
      {
        invoiceId: INVOICE_ID,
        methodCode: "MANUAL",
        invoiceAmountApplied: "100.00",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-08-24",
        processorFeeAmount: "-1",
      },
      deps,
    );
    expect(negativeFee.ok).toBe(false);

    const staff = await createPendingPayment(
      principal("STAFF"),
      {
        invoiceId: INVOICE_ID,
        methodCode: "MANUAL",
        invoiceAmountApplied: "100.00",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-08-24",
        processorFeeAmount: "9.99",
      },
      deps,
    );
    expect(staff.ok).toBe(false);
    if (!staff.ok) {
      expect(staff.status).toBe(403);
      expect(staff.error).toBe(PAYMENT_RECORD_FORBIDDEN);
    }
  });
});

describe("manual payment recording (TASK-050)", () => {
  it("records SUCCESSFUL via create→confirm, uses Admin rate, and locks the snapshot", async () => {
    const deps = createDeps({
      invoices: [
        invoiceRecord({ currencyCode: "GBP", invoiceTotal: "100", outstandingAmount: "100" }),
      ],
      gbpUsdRate: "1.250000000000",
    });
    const admin = principal("ADMIN");
    const beforeOutstanding = deps.invoices
      ? (await deps.invoices.getInvoiceById(INVOICE_ID))?.outstandingAmount
      : null;

    const recorded = await recordManualPayment(
      admin,
      {
        invoiceId: INVOICE_ID,
        invoiceAmountApplied: "40.00",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-08-24",
        externalTransactionId: "bank-ref-1001",
        notes: "Received by wire",
        processorFeeAmount: "2.00",
        actualReceivedAmount: "48.00",
      },
      deps,
    );
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) {
      throw new Error(recorded.error);
    }

    expect(recorded.data.status).toBe("SUCCESSFUL");
    expect(recorded.data.methodCode).toBe("MANUAL");
    expect(recorded.data.source).toBe("MANUAL");
    expect(recorded.data.companyId).toBe(COMPANY_A);
    expect(recorded.data.customerId).toBe(CUSTOMER_ID);
    expect(recorded.data.invoiceCurrencyCode).toBe("GBP");
    expect(recorded.data.settlementCurrencyCode).toBe("USD");
    expect(recorded.data.fixedConversionRate).toBe("1.25");
    expect(recorded.data.rateSource).toBe("ADMIN_FIXED_RATE");
    expect(recorded.data.rateVersionId).toBe(RATE_VERSION_ID);
    expect(recorded.data.convertedSettlementAmount).toBe("50");
    expect(recorded.data.processorFeeAmount).toBe("2");
    expect(recorded.data.actualReceivedAmount).toBe("48");
    expect(recorded.data.convertedSettlementAmount).not.toBe("48");
    expect(recorded.data.externalTransactionId).toBe("bank-ref-1001");
    expect(recorded.data.confirmedByUserId).toBe(ADMIN_ID);
    expect(recorded.data.receivedAt?.toISOString()).toBe("2026-08-24T15:00:00.000Z");

    assertConfirmedFinancialFieldsUnchanged(recorded.data, {
      invoiceAmountApplied: "40",
      convertedSettlementAmount: "50",
      fixedConversionRate: "1.25",
      processorFeeAmount: "2",
      actualReceivedAmount: "48",
    });

    const afterInvoice = await deps.invoices.getInvoiceById(INVOICE_ID);
    expect(afterInvoice?.outstandingAmount).toBe(beforeOutstanding);
    expect(afterInvoice?.confirmedPaidAmount).toBe("0");

    const createdAudit = deps.auditWriter.events.find(
      (event) => event.action === AuditActions.PAYMENT_CREATED,
    );
    const confirmedAudit = deps.auditWriter.events.find(
      (event) => event.action === AuditActions.PAYMENT_CONFIRMED,
    );
    expect(createdAudit).toBeDefined();
    expect(confirmedAudit).toBeDefined();
  });

  it("uses same-currency rate 1 and does not invent a gateway transaction id", async () => {
    const deps = createDeps({});
    const recorded = await recordManualPayment(
      principal("COMPLIANCE"),
      {
        invoiceId: INVOICE_ID,
        invoiceAmountApplied: "25.00",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-08-24",
      },
      deps,
    );
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) {
      throw new Error(recorded.error);
    }
    expect(recorded.data.fixedConversionRate).toBe("1");
    expect(recorded.data.rateSource).toBe("SAME_CURRENCY");
    expect(recorded.data.rateVersionId).toBeNull();
    expect(recorded.data.externalTransactionId).toBeNull();
    expect(recorded.data.methodCode).toBe("MANUAL");
    expect(recorded.data.source).toBe("MANUAL");
  });

  it("blocks cross-currency manual recording when Admin rate is missing", async () => {
    const deps = createDeps({
      invoices: [invoiceRecord({ currencyCode: "GBP" })],
      missingRate: true,
    });
    const recorded = await recordManualPayment(
      principal("ADMIN"),
      {
        invoiceId: INVOICE_ID,
        invoiceAmountApplied: "10.00",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-08-24",
      },
      deps,
    );
    expect(recorded.ok).toBe(false);
    if (!recorded.ok) {
      expect(recorded.status).toBe(400);
      expect(recorded.error).toBe(FIXED_RATE_MISSING_FOR_CONVERSION);
    }
  });

  it("rejects amounts above open balance without inventing overpayment allow (BR-010 / US-015)", async () => {
    const deps = createDeps({
      existingPayments: [
        {
          id: "00000000-0000-4000-8000-000000000099",
          companyId: COMPANY_A,
          invoiceId: INVOICE_ID,
          customerId: CUSTOMER_ID,
          methodCode: "MANUAL",
          externalTransactionId: null,
          status: "SUCCESSFUL",
          invoiceCurrencyCode: "USD",
          invoiceAmountApplied: "60",
          settlementCurrencyCode: "USD",
          fixedConversionRate: "1",
          rateVersionId: null,
          rateSource: "SAME_CURRENCY",
          rateEffectiveAt: new Date("2026-08-20T00:00:00.000Z"),
          convertedSettlementAmount: "60",
          processorFeeAmount: null,
          actualReceivedAmount: null,
          paymentDate: new Date("2026-08-20T00:00:00.000Z"),
          receivedAt: new Date("2026-08-20T00:00:00.000Z"),
          source: "MANUAL",
          notes: null,
          createdByUserId: ADMIN_ID,
          confirmedByUserId: ADMIN_ID,
          createdAt: new Date("2026-08-20T00:00:00.000Z"),
          updatedAt: new Date("2026-08-20T00:00:00.000Z"),
        },
      ],
    });

    const recorded = await recordManualPayment(
      principal("ADMIN"),
      {
        invoiceId: INVOICE_ID,
        invoiceAmountApplied: "50.00",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-08-24",
        processorFeeAmount: "99.00",
      },
      deps,
    );
    expect(recorded.ok).toBe(false);
    if (!recorded.ok) {
      expect(recorded.status).toBe(400);
      expect(recorded.error).toBe(PAYMENT_EXCEEDS_OPEN_BALANCE);
    }
  });

  it("denies Staff manual recording while US-007 remains default-deny", async () => {
    const deps = createDeps({});
    const recorded = await recordManualPayment(
      principal("STAFF"),
      {
        invoiceId: INVOICE_ID,
        invoiceAmountApplied: "10.00",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-08-24",
      },
      deps,
    );
    expect(recorded.ok).toBe(false);
    if (!recorded.ok) {
      expect(recorded.status).toBe(403);
      expect(recorded.error).toBe(PAYMENT_RECORD_FORBIDDEN);
    }
  });

  it("rejects client-supplied company/customer overrides and non-manual method fields", async () => {
    const deps = createDeps({});
    const withCompany = await recordManualPayment(
      principal("ADMIN"),
      {
        invoiceId: INVOICE_ID,
        companyId: COMPANY_B,
        customerId: "99999999-9999-4999-8999-999999999999",
        methodCode: "STRIPE",
        source: "GATEWAY_WEBHOOK",
        invoiceAmountApplied: "10.00",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-08-24",
      },
      deps,
    );
    expect(withCompany.ok).toBe(false);
    if (!withCompany.ok) {
      expect(withCompany.status).toBe(400);
    }
  });
});
