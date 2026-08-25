"use server";

import { revalidatePath } from "next/cache";

import { assertPermission, authorizePermission } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import { AuthorizationError, GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { FIXED_RATE_MISSING_FOR_CONVERSION } from "@/domain/fixed-rates/types";
import { isCollectibleInvoiceStatus } from "@/domain/invoices/cancellation";
import { canViewInvoice } from "@/domain/invoices/access";
import { INVOICE_NOT_FOUND, type InvoiceRecord } from "@/domain/invoices/types";
import {
  computeConvertedSettlementAmount,
  computeInvoiceOutstanding,
  moneyDecimal,
  roundMoney,
  toDecimalString,
} from "@/domain/money";
import { confirmedInvoiceApplicationsFromPayments } from "@/domain/payments/reconciliation";
import type { PaymentListQuery } from "@/domain/payments/schema";
import {
  PAYMENT_INVALID_INPUT,
  PAYMENT_RECORD_FORBIDDEN,
  type PaymentRecord,
} from "@/domain/payments/types";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { listSwitcherCompanies } from "@/server/company-context/accessible-companies";
import { loadCompanyContextForLayout } from "@/server/company-context/actions";
import { PrismaCurrencyStore } from "@/server/currencies/currency-repository";
import { resolveFixedConversionRate } from "@/server/fixed-rates/resolve-rate-service";
import { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";
import {
  recordManualPayment,
  createHostedCheckout,
  getPayment,
  listHostedCheckoutOptions,
  listPayments,
} from "@/server/payments/payment-service";
import type { HostedCheckoutOption } from "@/server/payments/payment-service";
import { PrismaPaymentStore } from "@/server/payments/payment-repository";
import { PrismaCustomerStore } from "@/server/customers/customer-repository";
import { PrismaSettlementConfigStore } from "@/server/settlement/settlement-repository";
import type { PaymentMethodCode } from "@/domain/settlement/types";

export type PaymentActionResult<T = undefined> =
  { ok: true; data?: T; message?: string; paymentId?: string } | { ok: false; error: string };

export type ManualPaymentInvoiceOption = {
  readonly id: string;
  readonly label: string;
  readonly companyId: string;
  readonly customerId: string;
  readonly currencyCode: string;
  readonly invoiceTotal: string;
  readonly outstandingAmount: string;
  readonly status: string;
};

export type ManualPaymentFormContext = {
  readonly invoice: {
    readonly id: string;
    readonly label: string;
    readonly companyId: string;
    readonly companyDisplayName: string;
    readonly customerId: string;
    readonly customerDisplayName: string | null;
    readonly currencyCode: string;
    readonly invoiceTotal: string;
    readonly outstandingAmount: string;
    readonly confirmedPaidAmount: string;
    readonly status: string;
    readonly decimalPrecision: number;
  };
  readonly settlementCurrencyCodes: readonly string[];
  readonly methodEnabled: boolean;
};

export type ManualPaymentConversionPreview = {
  readonly invoiceCurrencyCode: string;
  readonly settlementCurrencyCode: string;
  readonly invoiceAmountApplied: string;
  readonly fixedConversionRate: string;
  readonly rateSource: "same_currency" | "admin_fixed_rate";
  readonly convertedSettlementAmount: string;
  readonly settlementDecimalPrecision: number;
};

function invoiceLabel(invoice: InvoiceRecord): string {
  return invoice.invoiceNumber ?? `Invoice ${invoice.id.slice(0, 8)}`;
}

export type PaymentListRow = PaymentRecord & {
  readonly companyDisplayName: string;
  readonly invoiceLabel: string;
};

export type PaymentDetailView = PaymentRecord & {
  readonly companyDisplayName: string;
  readonly invoiceLabel: string;
  readonly customerDisplayName: string | null;
};

/**
 * Company options + default company for the payments transaction list (TASK-061).
 * Visibility uses invoice.create (same family as invoice list). Server still
 * enforces company assignment and invoice visibility on listPayments.
 */
export async function loadPaymentListOptions(companyId?: string | null) {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "invoice.create").allowed) {
    return {
      ok: false as const,
      status: 403 as const,
      error: GENERIC_FORBIDDEN,
      companies: [] as Array<{ id: string; displayName: string }>,
      defaultCompanyId: null as string | null,
      canRecordManual: false,
    };
  }

  const companies = await listSwitcherCompanies(actor);
  const context = await loadCompanyContextForLayout();
  const contextCompanyId =
    context.selection?.kind === "company" ? context.selection.companyId : null;
  const selectedCompanyId =
    companyId && companies.some((company) => company.id === companyId)
      ? companyId
      : contextCompanyId && companies.some((company) => company.id === contextCompanyId)
        ? contextCompanyId
        : companies.length === 1
          ? (companies[0]?.id ?? null)
          : null;

  return {
    ok: true as const,
    companies: companies.map((company) => ({
      id: company.id,
      displayName: company.displayName,
    })),
    defaultCompanyId: selectedCompanyId,
    canRecordManual: authorizePermission(actor, "payment.manual.record").allowed,
  };
}

/**
 * Company-scoped payments transaction list for UI (TASK-061).
 * Delegates to listPayments — Staff cannot see unassigned company rows.
 */
export async function loadPaymentsForUi(
  query: PaymentListQuery,
): Promise<
  | { ok: true; data: PaymentListRow[]; status?: undefined; error?: undefined }
  | { ok: false; error: string; status: number; data?: undefined }
> {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "invoice.create").allowed) {
    return { ok: false, status: 403, error: GENERIC_FORBIDDEN };
  }

  const result = await listPayments(actor, query);
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error };
  }

  const companies = await listSwitcherCompanies(actor);
  const companyNameById = new Map(companies.map((company) => [company.id, company.displayName]));

  const invoiceIds = [...new Set(result.data.map((payment) => payment.invoiceId))];
  const invoiceStore = new PrismaInvoiceStore();
  const invoices = await Promise.all(invoiceIds.map((id) => invoiceStore.getInvoiceById(id)));
  const invoiceLabelById = new Map(
    invoices
      .filter((invoice): invoice is InvoiceRecord => invoice != null)
      .map((invoice) => [invoice.id, invoiceLabel(invoice)]),
  );

  const ordered = [...result.data]
    .sort(
      (a, b) =>
        b.paymentDate.getTime() - a.paymentDate.getTime() ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    )
    .map((payment) => ({
      ...payment,
      companyDisplayName: companyNameById.get(payment.companyId) ?? payment.companyId.slice(0, 8),
      invoiceLabel:
        invoiceLabelById.get(payment.invoiceId) ?? `Invoice ${payment.invoiceId.slice(0, 8)}`,
    }));

  return { ok: true, data: ordered };
}

/**
 * Payment detail for UI (TASK-062). Delegates to getPayment — company assignment
 * + invoice visibility. Confirmed financial fields are read-only (BR-020 / BR-004).
 */
export async function loadPaymentForUi(
  paymentId: string,
): Promise<
  | { ok: true; data: PaymentDetailView; status?: undefined; error?: undefined }
  | { ok: false; error: string; status: number; data?: undefined }
> {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "invoice.create").allowed) {
    return { ok: false, status: 403, error: GENERIC_FORBIDDEN };
  }

  const result = await getPayment(actor, paymentId);
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error };
  }

  const payment = result.data;
  const companies = await listSwitcherCompanies(actor);
  const companyDisplayName =
    companies.find((company) => company.id === payment.companyId)?.displayName ??
    payment.companyId.slice(0, 8);

  const [invoice, customer] = await Promise.all([
    new PrismaInvoiceStore().getInvoiceById(payment.invoiceId),
    new PrismaCustomerStore().getCustomerById(payment.customerId),
  ]);

  return {
    ok: true,
    data: {
      ...payment,
      companyDisplayName,
      invoiceLabel: invoice ? invoiceLabel(invoice) : `Invoice ${payment.invoiceId.slice(0, 8)}`,
      customerDisplayName: customer?.displayName ?? null,
    },
  };
}

/**
 * List payments for an invoice view (TASK-059). Multiple records may coexist.
 * Confirmed applications drive allocation on the invoice (TASK-060).
 */
export async function loadInvoicePaymentsForUi(
  invoiceId: string,
): Promise<PaymentActionResult<{ payments: PaymentRecord[] }>> {
  const actor = await getRequestAuthorizationPrincipal();
  if (!actor) {
    return { ok: false, error: PAYMENT_RECORD_FORBIDDEN };
  }

  const invoiceStore = new PrismaInvoiceStore();
  const invoice = await invoiceStore.getInvoiceById(invoiceId);
  if (!invoice) {
    return { ok: false, error: INVOICE_NOT_FOUND };
  }

  try {
    assertCompanyAccess(actor, invoice.companyId);
  } catch {
    return { ok: false, error: INVOICE_NOT_FOUND };
  }
  if (!canViewInvoice(actor, invoice)) {
    return { ok: false, error: INVOICE_NOT_FOUND };
  }

  const result = await listPayments(actor, {
    companyId: invoice.companyId,
    invoiceId: invoice.id,
  });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const ordered = [...result.data].sort(
    (a, b) =>
      b.paymentDate.getTime() - a.paymentDate.getTime() ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  );
  return { ok: true, data: { payments: ordered } };
}

/**
 * Record a manual payment (TASK-051 UI → TASK-050 service).
 * Confirm path allocates invoice paid/outstanding and status (TASK-060).
 */
export async function recordManualPaymentAction(
  input: unknown,
): Promise<PaymentActionResult<{ paymentId: string; invoiceId: string }>> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await recordManualPayment(actor, input);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  revalidatePath(`/invoices/${result.data.invoiceId}`);
  revalidatePath("/payments");
  revalidatePath("/payments/manual");
  return {
    ok: true,
    message: "Manual payment recorded.",
    paymentId: result.data.id,
    data: { paymentId: result.data.id, invoiceId: result.data.invoiceId },
  };
}

/**
 * Load hosted checkout method options for invoice email (TASK-058).
 * Disabled/uncredentialed methods omitted. Requires invoice.create.
 */
export async function loadHostedCheckoutOptionsAction(
  invoiceId: string,
): Promise<PaymentActionResult<{ options: HostedCheckoutOption[] }>> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await listHostedCheckoutOptions(actor, invoiceId);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true, data: { options: result.data } };
}

/**
 * Create hosted checkout + PENDING payment (TASK-058). Does not mark Paid.
 */
export async function createHostedCheckoutAction(input: unknown): Promise<
  PaymentActionResult<{
    paymentId: string;
    invoiceId: string;
    checkoutUrl: string;
    methodCode: PaymentMethodCode;
    externalTransactionId: string;
  }>
> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await createHostedCheckout(actor, input);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  revalidatePath(`/invoices/${result.data.payment.invoiceId}`);
  return {
    ok: true,
    message: "Hosted checkout created.",
    paymentId: result.data.payment.id,
    data: {
      paymentId: result.data.payment.id,
      invoiceId: result.data.payment.invoiceId,
      checkoutUrl: result.data.checkoutUrl,
      methodCode: result.data.payment.methodCode,
      externalTransactionId: result.data.externalTransactionId,
    },
  };
}

/**
 * Load MANUAL settlement currencies + invoice snapshot for the Record Payment form.
 * Requires payment.manual.record (Staff denied). Does not use gateway.credentials.manage.
 */
export async function loadManualPaymentFormContext(
  invoiceId: string,
): Promise<PaymentActionResult<ManualPaymentFormContext> & { status?: number }> {
  try {
    const actor = await getRequestAuthorizationPrincipal();
    assertPermission(actor, "payment.manual.record");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const invoices = new PrismaInvoiceStore();
    const invoice = await invoices.getInvoiceById(invoiceId);
    if (!invoice) {
      return { ok: false, error: INVOICE_NOT_FOUND, status: 404 };
    }

    assertCompanyAccess(actor, invoice.companyId);
    if (!canViewInvoice(actor, invoice)) {
      return { ok: false, error: INVOICE_NOT_FOUND, status: 404 };
    }

    if (!isCollectibleInvoiceStatus(invoice.status)) {
      return {
        ok: false,
        error: "Payments cannot be recorded against draft or cancelled invoices.",
        status: 400,
      };
    }

    const settlementStore = new PrismaSettlementConfigStore();
    const settlement = await settlementStore.getCompanySettlementConfiguration(invoice.companyId);
    const manualMethod = settlement?.methods.find((method) => method.methodCode === "MANUAL");
    const currencies = new PrismaCurrencyStore();
    const invoiceCurrency = await currencies.findByCode(invoice.currencyCode);
    const invoicePrecision = invoiceCurrency?.decimalPrecision ?? 2;

    const paymentStore = new PrismaPaymentStore();
    const existingPayments = await paymentStore.listPayments({
      companyIds: [invoice.companyId],
      invoiceId: invoice.id,
    });
    const openBalance = computeInvoiceOutstanding({
      invoiceTotal: invoice.invoiceTotal,
      invoiceCurrencyCode: invoice.currencyCode,
      confirmedApplications: confirmedInvoiceApplicationsFromPayments(existingPayments),
      decimalPrecision: invoicePrecision,
    });

    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const [company, customer] = await Promise.all([
      prisma.company.findUnique({
        where: { id: invoice.companyId },
        select: { displayName: true },
      }),
      prisma.customer.findUnique({
        where: { id: invoice.customerId },
        select: { displayName: true },
      }),
    ]);

    return {
      ok: true,
      data: {
        invoice: {
          id: invoice.id,
          label: invoiceLabel(invoice),
          companyId: invoice.companyId,
          companyDisplayName: company?.displayName ?? invoice.companyId,
          customerId: invoice.customerId,
          customerDisplayName: customer?.displayName ?? null,
          currencyCode: invoice.currencyCode,
          invoiceTotal: invoice.invoiceTotal,
          // Open balance for the form uses SUCCESSFUL applications (BR-010).
          // Stored invoice outstanding is kept in sync by TASK-060 allocation.
          outstandingAmount: openBalance.amount,
          confirmedPaidAmount: invoice.confirmedPaidAmount,
          status: invoice.status,
          decimalPrecision: invoicePrecision,
        },
        settlementCurrencyCodes: manualMethod?.enabledSettlementCurrencyCodes ?? [],
        methodEnabled: manualMethod?.methodEnabled ?? false,
      },
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: PAYMENT_RECORD_FORBIDDEN, status: 403 };
    }
    return { ok: false, error: PAYMENT_INVALID_INPUT, status: 503 };
  }
}

/**
 * Display-only conversion preview (not authoritative). Server record path remains source of truth.
 */
export async function previewManualPaymentConversion(input: {
  readonly invoiceId: string;
  readonly settlementCurrencyCode: string;
  readonly invoiceAmountApplied: string;
  readonly paymentDate: string;
}): Promise<PaymentActionResult<ManualPaymentConversionPreview> & { status?: number }> {
  try {
    const actor = await getRequestAuthorizationPrincipal();
    assertPermission(actor, "payment.manual.record");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const invoices = new PrismaInvoiceStore();
    const invoice = await invoices.getInvoiceById(input.invoiceId);
    if (!invoice || !canViewInvoice(actor, invoice)) {
      return { ok: false, error: INVOICE_NOT_FOUND, status: 404 };
    }
    assertCompanyAccess(actor, invoice.companyId);

    const settlementCode = input.settlementCurrencyCode.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(settlementCode)) {
      return { ok: false, error: PAYMENT_INVALID_INPUT, status: 400 };
    }

    let applied;
    try {
      applied = moneyDecimal(input.invoiceAmountApplied);
    } catch {
      return { ok: false, error: PAYMENT_INVALID_INPUT, status: 400 };
    }
    if (!applied.gt(0)) {
      return { ok: false, error: "Invoice amount applied must be greater than zero.", status: 400 };
    }

    const paymentDate = /^\d{4}-\d{2}-\d{2}$/.test(input.paymentDate.trim())
      ? new Date(`${input.paymentDate.trim()}T00:00:00.000Z`)
      : new Date(input.paymentDate);
    if (Number.isNaN(paymentDate.getTime())) {
      return { ok: false, error: PAYMENT_INVALID_INPUT, status: 400 };
    }

    const currencies = new PrismaCurrencyStore();
    const [invoiceCurrency, settlementCurrency] = await Promise.all([
      currencies.findByCode(invoice.currencyCode),
      currencies.findByCode(settlementCode),
    ]);
    if (!settlementCurrency || settlementCurrency.status !== "ACTIVE") {
      return { ok: false, error: PAYMENT_INVALID_INPUT, status: 400 };
    }

    const invoicePrecision = invoiceCurrency?.decimalPrecision ?? 2;
    const invoiceAmountApplied = toDecimalString(roundMoney(applied, invoicePrecision));

    const rateResult = await resolveFixedConversionRate(
      invoice.currencyCode,
      settlementCode,
      paymentDate,
    );
    if (!rateResult.ok) {
      return { ok: false, error: FIXED_RATE_MISSING_FOR_CONVERSION, status: 400 };
    }

    const converted = computeConvertedSettlementAmount({
      invoiceAmountApplied,
      invoiceCurrencyCode: invoice.currencyCode,
      settlementCurrencyCode: settlementCode,
      fixedConversionRate: rateResult.fixedRate,
      settlementDecimalPrecision: settlementCurrency.decimalPrecision,
      processorFee: null,
    });

    return {
      ok: true,
      data: {
        invoiceCurrencyCode: invoice.currencyCode,
        settlementCurrencyCode: settlementCode,
        invoiceAmountApplied,
        fixedConversionRate: converted.fixedConversionRateApplied,
        rateSource: converted.rateSource,
        convertedSettlementAmount: converted.convertedSettlementAmount.amount,
        settlementDecimalPrecision: settlementCurrency.decimalPrecision,
      },
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: PAYMENT_RECORD_FORBIDDEN, status: 403 };
    }
    return { ok: false, error: PAYMENT_INVALID_INPUT, status: 503 };
  }
}

/**
 * Collectible invoices for standalone Manual payment entry (company-scoped).
 */
export async function loadCollectibleInvoicesForManualPayment(
  companyId: string,
): Promise<PaymentActionResult<ManualPaymentInvoiceOption[]> & { status?: number }> {
  try {
    const actor = await getRequestAuthorizationPrincipal();
    assertPermission(actor, "payment.manual.record");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    assertCompanyAccess(actor, companyId);

    const invoices = new PrismaInvoiceStore();
    const rows = await invoices.listInvoices({ companyIds: [companyId] });
    const options = rows
      .filter((row) => isCollectibleInvoiceStatus(row.status) && canViewInvoice(actor, row))
      .map((row) => ({
        id: row.id,
        label: `${invoiceLabel(row)} · ${row.currencyCode} ${row.outstandingAmount}`,
        companyId: row.companyId,
        customerId: row.customerId,
        currencyCode: row.currencyCode,
        invoiceTotal: row.invoiceTotal,
        outstandingAmount: row.outstandingAmount,
        status: row.status,
      }));

    return { ok: true, data: options };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: PAYMENT_RECORD_FORBIDDEN, status: 403 };
    }
    return { ok: false, error: PAYMENT_INVALID_INPUT, status: 503 };
  }
}
