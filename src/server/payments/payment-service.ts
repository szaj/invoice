import "server-only";

import { logger } from "@/lib/logger";
import { AuditActions, AuditEntityTypes } from "@/domain/audit/types";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import {
  assertCompanyAccess,
  assignedCompanyIdsOf,
  companyScopeForRole,
} from "@/domain/authz/company-access";
import { AuthorizationError, GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { CURRENCY_DISABLED_FOR_NEW_SELECTION } from "@/domain/currencies/types";
import { FIXED_RATE_MISSING_FOR_CONVERSION } from "@/domain/fixed-rates/types";
import { isCollectibleInvoiceStatus } from "@/domain/invoices/cancellation";
import { INVOICE_NOT_FOUND, type InvoiceRecord } from "@/domain/invoices/types";
import { requireApplicationBaseUrl } from "@/config/env";
import {
  computeConvertedSettlementAmount,
  computeInvoiceOutstanding,
  moneyDecimal,
  roundMoney,
  toDecimalString,
} from "@/domain/money";
import { canViewPayment } from "@/domain/payments/access";
import type { ListPage } from "@/domain/lists/pagination";
import { listPageOf, resolveListPagination } from "@/domain/lists/pagination";
import {
  assertConfirmedFinancialFieldsUnchanged,
  assertProcessorFeeExcludedFromSettlement,
} from "@/domain/payments/invariants";
import {
  assertReconciliationExcludedFromFinancialFormulas,
  confirmedInvoiceApplicationsFromPayments,
  normalizePaymentReconciliationFields,
} from "@/domain/payments/reconciliation";
import {
  assertManualPaymentWithinOpenBalance,
  assertPaymentWithinOpenBalance,
} from "@/domain/payments/manual";
import {
  PROVIDER_CAPABILITY_UNSUPPORTED,
  PROVIDER_CONFIGURATION_ERROR,
  PROVIDER_CREDENTIALS_MISSING,
  PROVIDER_INVALID_INPUT,
  PROVIDER_INVALID_RESPONSE,
  PROVIDER_METHOD_DISABLED,
  PROVIDER_NOT_REGISTERED,
  PROVIDER_REQUEST_REJECTED,
  PROVIDER_UNAVAILABLE,
} from "@/domain/payments/providers/errors";
import {
  resolvePaymentProvider,
  type PaymentProviderRegistry,
} from "@/domain/payments/providers/registry";
import {
  paymentCreatePendingSchema,
  paymentHostedCheckoutSchema,
  paymentIdSchema,
  paymentListQuerySchema,
  paymentManualRecordSchema,
  paymentWriteSchema,
  resolvePaymentListQuery,
  type PaymentCreatePendingInput,
} from "@/domain/payments/schema";
import {
  confirmSnapshotLock,
  isConversionSnapshotComplete,
  isCrossCurrencyPayment,
  snapshotRateEffectiveAt,
} from "@/domain/payments/snapshot";
import { assertPaymentStatusTransition } from "@/domain/payments/transitions";
import {
  PAYMENT_AMOUNT_NOT_POSITIVE,
  PAYMENT_CHECKOUT_CREDENTIALS_REQUIRED,
  PAYMENT_CHECKOUT_METHOD_UNSUPPORTED,
  PAYMENT_CHECKOUT_NO_OUTSTANDING,
  PAYMENT_CHECKOUT_PROVIDER_FAILED,
  PAYMENT_COMPANY_SCOPE_REQUIRED,
  PAYMENT_CONFIRMED_IMMUTABLE,
  PAYMENT_EXCEEDS_OPEN_BALANCE,
  PAYMENT_FEE_MUST_NOT_AFFECT_BALANCE,
  PAYMENT_FEE_MUST_NOT_AFFECT_SETTLEMENT,
  PAYMENT_ILLEGAL_TRANSITION,
  PAYMENT_INVALID_INPUT,
  PAYMENT_INVOICE_NOT_PAYABLE,
  PAYMENT_MANUAL_PROVIDER_MISCONFIGURED,
  PAYMENT_NOT_FOUND,
  PAYMENT_RECORD_FORBIDDEN,
  PAYMENT_UNAVAILABLE,
  type PaymentRateSource,
  type PaymentRecord,
  type PaymentStatus,
} from "@/domain/payments/types";
import { assertSettlementCurrencyEnabled } from "@/domain/settlement/assert-enabled";
import { SETTLEMENT_CURRENCY_NOT_ENABLED, type PaymentMethodCode } from "@/domain/settlement/types";
import {
  getAuditWriter,
  recordAuditEventRequired,
  type AuditWriter,
} from "@/server/audit/audit-service";
import { assertTransactionalCompanyRequest } from "@/server/company-context/transactional";
import { PrismaCurrencyStore } from "@/server/currencies/currency-repository";
import { PrismaCustomerStore } from "@/server/customers/customer-repository";
import {
  resolveFixedConversionRate,
  type ResolveRateDependencies,
} from "@/server/fixed-rates/resolve-rate-service";
import { PrismaGatewayConfigStore } from "@/server/gateway-config/gateway-config-repository";
import { allocateInvoiceFromConfirmedPayments } from "@/server/invoices/invoice-payment-allocation";
import { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";
import { PrismaPaymentStore } from "@/server/payments/payment-repository";
import { createPaymentProviderRegistry } from "@/server/payments/providers/create-payment-provider-registry";
import { PrismaSystemSettingsStore } from "@/server/settings/settings-repository";
import { PrismaSettlementConfigStore } from "@/server/settlement/settlement-repository";
import { emitOperationalNotification } from "@/server/notifications/notification-service";

export type PaymentServiceResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 401 | 403 | 404 | 503; error: string };

export interface PaymentServiceDependencies {
  readonly payments: Pick<
    PrismaPaymentStore,
    | "getPaymentById"
    | "getPaymentByExternalTransaction"
    | "listPayments"
    | "listPaymentsPage"
    | "createPayment"
    | "updatePaymentLifecycle"
  >;
  readonly invoices: Pick<
    PrismaInvoiceStore,
    "getInvoiceById" | "listInvoices" | "updatePaymentAllocation"
  >;
  readonly customers: Pick<PrismaCustomerStore, "getCustomerById">;
  readonly settlement: Pick<PrismaSettlementConfigStore, "getCompanySettlementConfiguration">;
  readonly currencies: Pick<PrismaCurrencyStore, "findByCode">;
  readonly settings?: Pick<PrismaSystemSettingsStore, "getSettings">;
  readonly gatewayConfigs?: Pick<
    PrismaGatewayConfigStore,
    "getMethodRow" | "getCompanyGatewayConfiguration"
  >;
  readonly resolveRate?: (
    fromCurrency: string,
    toCurrency: string,
    at: Date,
  ) => ReturnType<typeof resolveFixedConversionRate>;
  readonly resolveRateDeps?: ResolveRateDependencies;
  readonly auditWriter?: AuditWriter;
  readonly now?: () => Date;
  /** Override for tests; production uses assertTransactionalCompanyRequest. */
  readonly enforceTransactionalCompanyScope?: (
    actor: AuthorizationPrincipal,
    companyId: string,
  ) => Promise<PaymentServiceResult<true>>;
  readonly providerRegistry?: PaymentProviderRegistry;
  /** Override APP_URL-derived return URLs in tests. */
  readonly checkoutReturnBaseUrl?: string;
}

export type HostedCheckoutOption = {
  readonly methodCode: PaymentMethodCode;
  readonly label: string;
  readonly enabledSettlementCurrencyCodes: readonly string[];
};

export type HostedCheckoutResult = {
  readonly payment: PaymentRecord;
  readonly checkoutUrl: string;
  readonly externalTransactionId: string;
};

export function createDefaultPaymentServiceDependencies(): PaymentServiceDependencies {
  return {
    payments: new PrismaPaymentStore(),
    invoices: new PrismaInvoiceStore(),
    customers: new PrismaCustomerStore(),
    settlement: new PrismaSettlementConfigStore(),
    currencies: new PrismaCurrencyStore(),
    settings: new PrismaSystemSettingsStore(),
    gatewayConfigs: new PrismaGatewayConfigStore(),
  };
}

async function allocateAfterSuccessfulPayment(
  payment: PaymentRecord,
  input: {
    readonly actorType: "USER" | "WEBHOOK" | "SYSTEM";
    readonly actorUserId?: string | null;
    readonly correlationId?: string | null;
  },
  deps: PaymentServiceDependencies,
): Promise<void> {
  await allocateInvoiceFromConfirmedPayments(
    {
      invoiceId: payment.invoiceId,
      companyId: payment.companyId,
      actorType: input.actorType,
      actorUserId: input.actorUserId ?? null,
      correlationId: input.correlationId ?? null,
    },
    {
      invoices: deps.invoices,
      payments: deps.payments,
      currencies: deps.currencies,
      settings: deps.settings,
      auditWriter: auditWriterOf(deps),
    },
  );
}

async function emitPaymentOperationalNotification(
  kind: "PAYMENT_SUCCESS" | "PAYMENT_FAILED",
  payment: PaymentRecord,
  deps: PaymentServiceDependencies,
): Promise<void> {
  const invoice = await deps.invoices.getInvoiceById(payment.invoiceId);
  await emitOperationalNotification({
    kind,
    companyId: payment.companyId,
    paymentId: payment.id,
    invoiceId: payment.invoiceId,
    invoiceNumber: invoice?.invoiceNumber ?? null,
    amount: payment.invoiceAmountApplied,
    currencyCode: payment.invoiceCurrencyCode,
    methodCode: payment.methodCode,
  });
}

function gatewayConfigsOf(
  deps: PaymentServiceDependencies,
): Pick<PrismaGatewayConfigStore, "getMethodRow" | "getCompanyGatewayConfiguration"> {
  return deps.gatewayConfigs ?? new PrismaGatewayConfigStore();
}

function hostedCheckoutLabel(methodCode: PaymentMethodCode): string {
  switch (methodCode) {
    case "STRIPE":
      return "Stripe";
    case "PAYPAL":
      return "PayPal";
    case "BANK_PROCESSOR":
      return "Bank processor";
    case "MANUAL":
      return "Manual";
    default: {
      const _exhaustive: never = methodCode;
      return _exhaustive;
    }
  }
}

function checkoutReturnUrls(
  deps: PaymentServiceDependencies,
  invoiceId: string,
): { successUrl: string; cancelUrl: string } {
  const base = (deps.checkoutReturnBaseUrl ?? requireApplicationBaseUrl()).replace(/\/$/, "");
  const successUrl = `${base}/payments/checkout/return?status=success&invoiceId=${encodeURIComponent(invoiceId)}`;
  const cancelUrl = `${base}/payments/checkout/return?status=cancel&invoiceId=${encodeURIComponent(invoiceId)}`;
  return { successUrl, cancelUrl };
}

function auditWriterOf(deps: PaymentServiceDependencies): AuditWriter {
  return deps.auditWriter ?? getAuditWriter();
}

function nowOf(deps: PaymentServiceDependencies): Date {
  return deps.now?.() ?? new Date();
}

function accessibleCompanyIds(actor: AuthorizationPrincipal): string[] | "ALL" {
  const scope = companyScopeForRole(actor.roleCode);
  if (scope === "ALL") {
    return "ALL";
  }
  return [...assignedCompanyIdsOf(actor)];
}

function mapRateSource(source: "same_currency" | "admin_fixed_rate"): PaymentRateSource {
  return source === "same_currency" ? "SAME_CURRENCY" : "ADMIN_FIXED_RATE";
}

function paymentAuditSnapshot(payment: PaymentRecord) {
  return {
    id: payment.id,
    companyId: payment.companyId,
    invoiceId: payment.invoiceId,
    customerId: payment.customerId,
    methodCode: payment.methodCode,
    status: payment.status,
    invoiceCurrencyCode: payment.invoiceCurrencyCode,
    invoiceAmountApplied: payment.invoiceAmountApplied,
    settlementCurrencyCode: payment.settlementCurrencyCode,
    fixedConversionRate: payment.fixedConversionRate,
    rateSource: payment.rateSource,
    rateVersionId: payment.rateVersionId,
    rateEffectiveAt: payment.rateEffectiveAt?.toISOString() ?? null,
    convertedSettlementAmount: payment.convertedSettlementAmount,
    processorFeeAmount: payment.processorFeeAmount,
    actualReceivedAmount: payment.actualReceivedAmount,
    paymentDate: payment.paymentDate.toISOString().slice(0, 10),
    source: payment.source,
    externalTransactionId: payment.externalTransactionId,
  };
}

async function resolveRateOf(
  deps: PaymentServiceDependencies,
  fromCurrency: string,
  toCurrency: string,
  at: Date,
) {
  if (deps.resolveRate) {
    return deps.resolveRate(fromCurrency, toCurrency, at);
  }
  return resolveFixedConversionRate(fromCurrency, toCurrency, at, deps.resolveRateDeps);
}

async function enforceTransactionalCompanyScopeOf(
  actor: AuthorizationPrincipal,
  companyId: string,
  deps: PaymentServiceDependencies,
): Promise<PaymentServiceResult<true>> {
  if (deps.enforceTransactionalCompanyScope) {
    return deps.enforceTransactionalCompanyScope(actor, companyId);
  }
  const scope = await assertTransactionalCompanyRequest(actor, companyId);
  if (!scope.ok) {
    return { ok: false, status: scope.status, error: scope.error };
  }
  return { ok: true, data: true };
}

/**
 * Manual recording uses ManualPaymentAdapter without hosted checkout or fake webhooks (ADR-008).
 */
function assertManualProviderPath(deps: PaymentServiceDependencies): PaymentServiceResult<true> {
  const registry = deps.providerRegistry ?? createPaymentProviderRegistry();
  const provider = registry.require("MANUAL");
  if (
    provider.capabilities.supportsHostedCheckout ||
    provider.capabilities.supportsWebhooks ||
    provider.capabilities.supportsPaymentStatusLookup
  ) {
    return { ok: false, status: 503, error: PAYMENT_MANUAL_PROVIDER_MISCONFIGURED };
  }
  return { ok: true, data: true };
}

async function loadVisibleInvoiceForPayment(
  actor: AuthorizationPrincipal,
  payment: PaymentRecord,
  deps: PaymentServiceDependencies,
): Promise<PaymentServiceResult<InvoiceRecord>> {
  assertCompanyAccess(actor, payment.companyId);
  const invoice = await deps.invoices.getInvoiceById(payment.invoiceId);
  if (!invoice || !canViewPayment(actor, payment, invoice)) {
    return { ok: false, status: 404, error: PAYMENT_NOT_FOUND };
  }
  return { ok: true, data: invoice };
}

/**
 * GET payments (TASK-045). View follows company assignment + invoice visibility.
 * Does not require payment.manual.record (Staff optional grant remains denied).
 */
export async function listPayments(
  actor: AuthorizationPrincipal | null,
  query: unknown = {},
  deps: PaymentServiceDependencies = createDefaultPaymentServiceDependencies(),
): Promise<PaymentServiceResult<ListPage<PaymentRecord>>> {
  try {
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }
    if (actor.status !== "ACTIVE" || !actor.roleCode) {
      throw new AuthorizationError(actor.status !== "ACTIVE" ? "suspended" : "missing_role");
    }

    const parsed = paymentListQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      return { ok: false, status: 400, error: PAYMENT_INVALID_INPUT };
    }

    const resolved = resolvePaymentListQuery(parsed.data);
    const pagination = resolveListPagination({
      page: resolved.page,
      pageSize: resolved.pageSize,
    });

    const accessible = accessibleCompanyIds(actor);
    let companyIds: string[];
    if (resolved.companyId) {
      assertCompanyAccess(actor, resolved.companyId);
      companyIds = [resolved.companyId];
    } else if (accessible === "ALL") {
      return { ok: false, status: 400, error: PAYMENT_COMPANY_SCOPE_REQUIRED };
    } else {
      companyIds = accessible;
    }

    const staffUserId = actor.roleCode === "STAFF" ? actor.userId : null;
    const page = await deps.payments.listPaymentsPage({
      companyIds,
      invoiceId: resolved.invoiceId,
      customerId: resolved.customerId,
      status: resolved.status,
      visibleToStaffUserId: staffUserId,
      page: pagination.page,
      pageSize: pagination.pageSize,
      sortBy: resolved.sortBy,
      sortDir: resolved.sortDir,
    });

    return { ok: true, data: listPageOf(page.rows, page.totalCount, pagination) };
  } catch (error) {
    return toPaymentError(error, "read");
  }
}

export async function getPayment(
  actor: AuthorizationPrincipal | null,
  paymentId: string,
  deps: PaymentServiceDependencies = createDefaultPaymentServiceDependencies(),
): Promise<PaymentServiceResult<PaymentRecord>> {
  try {
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsedId = paymentIdSchema.safeParse(paymentId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: PAYMENT_NOT_FOUND };
    }

    const payment = await deps.payments.getPaymentById(parsedId.data);
    if (!payment) {
      return { ok: false, status: 404, error: PAYMENT_NOT_FOUND };
    }

    const invoiceResult = await loadVisibleInvoiceForPayment(actor, payment, deps);
    if (!invoiceResult.ok) {
      return invoiceResult;
    }

    return { ok: true, data: payment };
  } catch (error) {
    return toPaymentError(error, "read");
  }
}

/**
 * Persist a PENDING payment with Admin fixed-rate snapshot (TASK-045 / TASK-046).
 * Caller must already enforce authorization. Does not charge gateways or allocate.
 */
async function persistPendingPayment(
  actor: AuthorizationPrincipal,
  parsed: PaymentCreatePendingInput,
  deps: PaymentServiceDependencies,
): Promise<PaymentServiceResult<PaymentRecord>> {
  const invoice = await deps.invoices.getInvoiceById(parsed.invoiceId);
  if (!invoice) {
    return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
  }

  assertCompanyAccess(actor, invoice.companyId);
  if (!canViewPayment(actor, { companyId: invoice.companyId }, invoice)) {
    return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
  }

  if (!isCollectibleInvoiceStatus(invoice.status)) {
    return { ok: false, status: 400, error: PAYMENT_INVOICE_NOT_PAYABLE };
  }

  const customer = await deps.customers.getCustomerById(invoice.customerId);
  if (!customer || !customer.companyIds.includes(invoice.companyId)) {
    return { ok: false, status: 400, error: PAYMENT_INVALID_INPUT };
  }

  const settlementConfig = await deps.settlement.getCompanySettlementConfiguration(
    invoice.companyId,
  );
  if (!settlementConfig) {
    return { ok: false, status: 400, error: PAYMENT_INVALID_INPUT };
  }
  const method = settlementConfig.methods.find((row) => row.methodCode === parsed.methodCode);
  const settlementCheck = assertSettlementCurrencyEnabled(method, parsed.settlementCurrencyCode);
  if (!settlementCheck.ok) {
    return { ok: false, status: 400, error: SETTLEMENT_CURRENCY_NOT_ENABLED };
  }

  const settlementCurrency = await deps.currencies.findByCode(parsed.settlementCurrencyCode);
  if (!settlementCurrency) {
    return { ok: false, status: 400, error: PAYMENT_INVALID_INPUT };
  }
  if (settlementCurrency.status !== "ACTIVE") {
    return { ok: false, status: 400, error: CURRENCY_DISABLED_FOR_NEW_SELECTION };
  }

  const invoiceCurrency = await deps.currencies.findByCode(invoice.currencyCode);
  const invoicePrecision = invoiceCurrency?.decimalPrecision ?? 2;

  let applied;
  try {
    applied = moneyDecimal(parsed.invoiceAmountApplied);
  } catch {
    return { ok: false, status: 400, error: PAYMENT_INVALID_INPUT };
  }
  if (!applied.gt(0)) {
    return { ok: false, status: 400, error: PAYMENT_AMOUNT_NOT_POSITIVE };
  }
  const invoiceAmountApplied = toDecimalString(roundMoney(applied, invoicePrecision));

  const existingPayments = await deps.payments.listPayments({
    companyIds: [invoice.companyId],
    invoiceId: invoice.id,
  });
  try {
    assertPaymentWithinOpenBalance({
      invoiceTotal: invoice.invoiceTotal,
      invoiceCurrencyCode: invoice.currencyCode,
      invoiceDecimalPrecision: invoicePrecision,
      invoiceAmountApplied,
      existingPayments,
      processorFeeAmount: parsed.processorFeeAmount,
      actualReceivedAmount: parsed.actualReceivedAmount,
    });
  } catch (error) {
    if (error instanceof Error && error.message === PAYMENT_EXCEEDS_OPEN_BALANCE) {
      return { ok: false, status: 400, error: PAYMENT_EXCEEDS_OPEN_BALANCE };
    }
    throw error;
  }

  let reconciliation;
  try {
    reconciliation = normalizePaymentReconciliationFields({
      processorFeeAmount: parsed.processorFeeAmount,
      actualReceivedAmount: parsed.actualReceivedAmount,
      convertedSettlementAmount: null,
    });
  } catch {
    return { ok: false, status: 400, error: PAYMENT_INVALID_INPUT };
  }

  const rateResult = await resolveRateOf(
    deps,
    invoice.currencyCode,
    settlementCurrency.code,
    parsed.paymentDate,
  );
  if (!rateResult.ok) {
    return { ok: false, status: 400, error: FIXED_RATE_MISSING_FOR_CONVERSION };
  }

  const converted = computeConvertedSettlementAmount({
    invoiceAmountApplied,
    invoiceCurrencyCode: invoice.currencyCode,
    settlementCurrencyCode: settlementCurrency.code,
    fixedConversionRate: rateResult.fixedRate,
    settlementDecimalPrecision: settlementCurrency.decimalPrecision,
    processorFee: reconciliation.processorFeeAmount,
  });

  const rateSource = mapRateSource(converted.rateSource);
  const writeParsed = paymentWriteSchema.safeParse({
    companyId: invoice.companyId,
    invoiceId: invoice.id,
    customerId: invoice.customerId,
    methodCode: parsed.methodCode,
    externalTransactionId: parsed.externalTransactionId,
    status: "PENDING",
    invoiceCurrencyCode: invoice.currencyCode,
    invoiceAmountApplied,
    settlementCurrencyCode: settlementCurrency.code,
    fixedConversionRate: converted.fixedConversionRateApplied,
    rateVersionId: rateResult.rateVersionId,
    rateSource,
    rateEffectiveAt: snapshotRateEffectiveAt({
      rateSource,
      paymentDate: parsed.paymentDate,
      rateValidFrom: rateResult.validFrom,
    }),
    convertedSettlementAmount: converted.convertedSettlementAmount.amount,
    processorFeeAmount: reconciliation.processorFeeAmount,
    actualReceivedAmount: reconciliation.actualReceivedAmount,
    paymentDate: parsed.paymentDate,
    receivedAt: null,
    source: parsed.source,
    notes: parsed.notes,
    createdByUserId: actor.userId,
    confirmedByUserId: null,
  });
  if (!writeParsed.success) {
    return { ok: false, status: 400, error: PAYMENT_INVALID_INPUT };
  }

  assertProcessorFeeExcludedFromSettlement(writeParsed.data, settlementCurrency.decimalPrecision);
  assertReconciliationExcludedFromFinancialFormulas({
    invoiceAmountApplied,
    invoiceCurrencyCode: invoice.currencyCode,
    settlementCurrencyCode: settlementCurrency.code,
    fixedConversionRate: converted.fixedConversionRateApplied,
    settlementDecimalPrecision: settlementCurrency.decimalPrecision,
    convertedSettlementAmount: converted.convertedSettlementAmount.amount,
    processorFeeAmount: reconciliation.processorFeeAmount,
    actualReceivedAmount: reconciliation.actualReceivedAmount,
    invoiceTotal: invoice.invoiceTotal,
    invoiceDecimalPrecision: invoicePrecision,
    confirmedApplications: [invoiceAmountApplied],
  });

  const created = await deps.payments.createPayment(writeParsed.data);

  await recordAuditEventRequired(
    {
      actorType: "USER",
      actorUserId: actor.userId,
      companyId: created.companyId,
      entityType: AuditEntityTypes.PAYMENT,
      entityId: created.id,
      action: AuditActions.PAYMENT_CREATED,
      newValues: paymentAuditSnapshot(created),
    },
    auditWriterOf(deps),
  );

  logger.info(
    {
      event: "payments.created",
      actorUserId: actor.userId,
      paymentId: created.id,
      invoiceId: created.invoiceId,
      companyId: created.companyId,
      status: created.status,
    },
    "Pending payment created",
  );

  return { ok: true, data: created };
}

/**
 * Create a PENDING payment (TASK-045).
 * authorization → company scope → invoice/customer → currency/settlement → conversion → persist → audit.
 * Stores the Admin fixed-rate snapshot including rateEffectiveAt (TASK-046).
 * Optional processor fee / actual received are stored as reconciliation only (TASK-047 / BR-020).
 * Does not charge gateways, allocate, or mutate invoice outstanding (later tasks).
 * Gateway HTTP/webhooks resolve through PaymentProviderRegistry (TASK-048 / ADR-008), not this service.
 */
export async function createPendingPayment(
  actor: AuthorizationPrincipal | null,
  input: unknown,
  deps: PaymentServiceDependencies = createDefaultPaymentServiceDependencies(),
): Promise<PaymentServiceResult<PaymentRecord>> {
  try {
    assertPermission(actor, "payment.manual.record");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsed = paymentCreatePendingSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, status: 400, error: PAYMENT_INVALID_INPUT };
    }

    return persistPendingPayment(actor, parsed.data, deps);
  } catch (error) {
    return toPaymentError(error, "write");
  }
}

/**
 * List company-enabled hosted checkout methods for an invoice (TASK-058).
 * Disabled / uncredentialed / unsupported (e.g. BANK_PROCESSOR deferred) methods are omitted.
 * Authorization: invoice.create (same family as send-invoice UI).
 */
export async function listHostedCheckoutOptions(
  actor: AuthorizationPrincipal | null,
  invoiceId: string,
  deps: PaymentServiceDependencies = createDefaultPaymentServiceDependencies(),
): Promise<PaymentServiceResult<HostedCheckoutOption[]>> {
  try {
    assertPermission(actor, "invoice.create");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsedId = paymentIdSchema.safeParse(invoiceId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }

    const invoice = await deps.invoices.getInvoiceById(parsedId.data);
    if (!invoice) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }

    assertCompanyAccess(actor, invoice.companyId);
    if (!canViewPayment(actor, { companyId: invoice.companyId }, invoice)) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }

    const registry = deps.providerRegistry ?? createPaymentProviderRegistry();
    const gatewayStore = gatewayConfigsOf(deps);
    const [companyGateways, settlementConfig] = await Promise.all([
      gatewayStore.getCompanyGatewayConfiguration(invoice.companyId),
      deps.settlement.getCompanySettlementConfiguration(invoice.companyId),
    ]);
    if (!companyGateways || !settlementConfig) {
      return { ok: true, data: [] };
    }

    const options: HostedCheckoutOption[] = [];
    for (const method of companyGateways.methods) {
      if (!method.methodEnabled || !method.credentialsConfigured) {
        continue;
      }
      const provider = registry.get(method.methodCode);
      if (!provider?.capabilities.supportsHostedCheckout) {
        continue;
      }
      const settlementMethod = settlementConfig.methods.find(
        (row) => row.methodCode === method.methodCode,
      );
      if (!settlementMethod?.methodEnabled) {
        continue;
      }
      const settlementCodes = settlementMethod.enabledSettlementCurrencyCodes.filter((code) =>
        method.enabledSettlementCurrencyCodes.includes(code),
      );
      if (settlementCodes.length === 0) {
        continue;
      }
      options.push({
        methodCode: method.methodCode,
        label: hostedCheckoutLabel(method.methodCode),
        enabledSettlementCurrencyCodes: settlementCodes,
      });
    }

    return { ok: true, data: options };
  } catch (error) {
    return toPaymentError(error, "read");
  }
}

/**
 * Create hosted checkout + PENDING payment with Admin rate snapshot (TASK-058).
 * Does not confirm SUCCESSFUL (webhooks / status later). Allocation runs on webhook confirm (TASK-060).
 * Credentials resolve only inside PaymentProvider adapters (ADR-022).
 */
export async function createHostedCheckout(
  actor: AuthorizationPrincipal | null,
  input: unknown,
  deps: PaymentServiceDependencies = createDefaultPaymentServiceDependencies(),
): Promise<PaymentServiceResult<HostedCheckoutResult>> {
  try {
    assertPermission(actor, "invoice.create");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsed = paymentHostedCheckoutSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, status: 400, error: PAYMENT_INVALID_INPUT };
    }

    const invoice = await deps.invoices.getInvoiceById(parsed.data.invoiceId);
    if (!invoice) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }

    const scope = await enforceTransactionalCompanyScopeOf(actor, invoice.companyId, deps);
    if (!scope.ok) {
      return scope;
    }

    if (!canViewPayment(actor, { companyId: invoice.companyId }, invoice)) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }

    if (!isCollectibleInvoiceStatus(invoice.status)) {
      return { ok: false, status: 400, error: PAYMENT_INVOICE_NOT_PAYABLE };
    }

    const registry = deps.providerRegistry ?? createPaymentProviderRegistry();
    const gatewayRow = await gatewayConfigsOf(deps).getMethodRow(
      invoice.companyId,
      parsed.data.methodCode,
    );
    const gatewayConfig = gatewayRow
      ? {
          companyId: gatewayRow.companyId,
          methodCode: gatewayRow.methodCode,
          enabled: gatewayRow.enabled,
          environment: gatewayRow.environment,
          enabledSettlementCurrencyCodes: gatewayRow.enabledSettlementCurrencyCodes,
          credentialsConfigured: gatewayRow.credentialsConfigured,
        }
      : null;
    if (!gatewayConfig?.enabled) {
      return { ok: false, status: 400, error: PAYMENT_CHECKOUT_METHOD_UNSUPPORTED };
    }
    if (!gatewayConfig.credentialsConfigured) {
      return { ok: false, status: 400, error: PAYMENT_CHECKOUT_CREDENTIALS_REQUIRED };
    }

    let provider;
    try {
      provider = resolvePaymentProvider(registry, gatewayConfig);
    } catch (error) {
      if (error instanceof Error && error.message === PROVIDER_METHOD_DISABLED) {
        return { ok: false, status: 400, error: PAYMENT_CHECKOUT_METHOD_UNSUPPORTED };
      }
      if (error instanceof Error && error.message === PROVIDER_NOT_REGISTERED) {
        return { ok: false, status: 400, error: PAYMENT_CHECKOUT_METHOD_UNSUPPORTED };
      }
      throw error;
    }

    if (!provider.capabilities.supportsHostedCheckout) {
      return { ok: false, status: 400, error: PAYMENT_CHECKOUT_METHOD_UNSUPPORTED };
    }

    const invoiceCurrency = await deps.currencies.findByCode(invoice.currencyCode);
    const invoicePrecision = invoiceCurrency?.decimalPrecision ?? 2;
    const settlementCurrency = await deps.currencies.findByCode(parsed.data.settlementCurrencyCode);
    if (!settlementCurrency || settlementCurrency.status !== "ACTIVE") {
      return { ok: false, status: 400, error: PAYMENT_INVALID_INPUT };
    }

    const existingPayments = await deps.payments.listPayments({
      companyIds: [invoice.companyId],
      invoiceId: invoice.id,
    });
    const applications = confirmedInvoiceApplicationsFromPayments(existingPayments);
    const outstanding = computeInvoiceOutstanding({
      invoiceTotal: invoice.invoiceTotal,
      invoiceCurrencyCode: invoice.currencyCode,
      confirmedApplications: applications,
      decimalPrecision: invoicePrecision,
    });

    let invoiceAmountApplied: string;
    if (parsed.data.invoiceAmountApplied !== undefined) {
      let applied;
      try {
        applied = moneyDecimal(parsed.data.invoiceAmountApplied);
      } catch {
        return { ok: false, status: 400, error: PAYMENT_INVALID_INPUT };
      }
      if (!applied.gt(0)) {
        return { ok: false, status: 400, error: PAYMENT_AMOUNT_NOT_POSITIVE };
      }
      invoiceAmountApplied = toDecimalString(roundMoney(applied, invoicePrecision));
      assertManualPaymentWithinOpenBalance({
        invoiceTotal: invoice.invoiceTotal,
        invoiceCurrencyCode: invoice.currencyCode,
        invoiceDecimalPrecision: invoicePrecision,
        invoiceAmountApplied,
        existingPayments,
      });
    } else {
      if (!moneyDecimal(outstanding.amount).gt(0)) {
        return { ok: false, status: 400, error: PAYMENT_CHECKOUT_NO_OUTSTANDING };
      }
      invoiceAmountApplied = outstanding.amount;
    }

    const paymentDate = nowOf(deps);
    const rateResult = await resolveRateOf(
      deps,
      invoice.currencyCode,
      settlementCurrency.code,
      paymentDate,
    );
    if (!rateResult.ok) {
      return { ok: false, status: 400, error: FIXED_RATE_MISSING_FOR_CONVERSION };
    }

    const converted = computeConvertedSettlementAmount({
      invoiceAmountApplied,
      invoiceCurrencyCode: invoice.currencyCode,
      settlementCurrencyCode: settlementCurrency.code,
      fixedConversionRate: rateResult.fixedRate,
      settlementDecimalPrecision: settlementCurrency.decimalPrecision,
      processorFee: null,
    });

    const { successUrl, cancelUrl } = checkoutReturnUrls(deps, invoice.id);

    let providerResult;
    try {
      providerResult = await provider.createPaymentRequest({
        companyId: invoice.companyId,
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        invoiceCurrencyCode: invoice.currencyCode,
        invoiceAmountApplied,
        settlementCurrencyCode: settlementCurrency.code,
        settlementDecimalPrecision: settlementCurrency.decimalPrecision,
        convertedSettlementAmount: converted.convertedSettlementAmount.amount,
        successUrl,
        cancelUrl,
      });
    } catch (error) {
      return mapProviderCheckoutError(error);
    }

    if (!providerResult.checkoutUrl?.trim()) {
      return { ok: false, status: 503, error: PAYMENT_CHECKOUT_PROVIDER_FAILED };
    }

    const pending = await persistPendingPayment(
      actor,
      {
        invoiceId: invoice.id,
        methodCode: parsed.data.methodCode,
        invoiceAmountApplied,
        settlementCurrencyCode: settlementCurrency.code,
        paymentDate,
        externalTransactionId: providerResult.externalTransactionId,
        source: "GATEWAY_API",
        notes: null,
        processorFeeAmount: null,
        actualReceivedAmount: null,
      },
      deps,
    );
    if (!pending.ok) {
      return pending;
    }

    logger.info(
      {
        event: "payments.hosted_checkout_created",
        actorUserId: actor.userId,
        paymentId: pending.data.id,
        invoiceId: pending.data.invoiceId,
        companyId: pending.data.companyId,
        methodCode: pending.data.methodCode,
        externalTransactionId: pending.data.externalTransactionId,
      },
      "Hosted checkout payment created",
    );

    return {
      ok: true,
      data: {
        payment: pending.data,
        checkoutUrl: providerResult.checkoutUrl,
        externalTransactionId: providerResult.externalTransactionId,
      },
    };
  } catch (error) {
    return toPaymentError(error, "write");
  }
}

function mapProviderCheckoutError(error: unknown): {
  ok: false;
  status: 400 | 503;
  error: string;
} {
  if (error instanceof Error) {
    switch (error.message) {
      case PROVIDER_METHOD_DISABLED:
      case PROVIDER_CAPABILITY_UNSUPPORTED:
      case PROVIDER_NOT_REGISTERED:
        return { ok: false, status: 400, error: PAYMENT_CHECKOUT_METHOD_UNSUPPORTED };
      case PROVIDER_CREDENTIALS_MISSING:
        return { ok: false, status: 400, error: PAYMENT_CHECKOUT_CREDENTIALS_REQUIRED };
      case PROVIDER_INVALID_INPUT:
      case PROVIDER_CONFIGURATION_ERROR:
        return { ok: false, status: 400, error: PAYMENT_INVALID_INPUT };
      case PROVIDER_REQUEST_REJECTED:
      case PROVIDER_INVALID_RESPONSE:
      case PROVIDER_UNAVAILABLE:
        return { ok: false, status: 503, error: PAYMENT_CHECKOUT_PROVIDER_FAILED };
      default:
        break;
    }
  }
  logger.error(
    {
      event: "payments.hosted_checkout_provider_failed",
      err: error instanceof Error ? error.message : "unknown",
    },
    "Hosted checkout provider create failed",
  );
  return { ok: false, status: 503, error: PAYMENT_CHECKOUT_PROVIDER_FAILED };
}

/**
 * Record a manual payment (TASK-050 / Payments §10.6).
 * Reuses TASK-045 create PENDING → confirm SUCCESSFUL lifecycle on the same payment domain.
 * Forces method MANUAL + source MANUAL. Does not invent gateway transaction IDs or fake webhooks.
 * Confirm path allocates invoice paid/outstanding and status (TASK-060).
 * Staff remains denied (US-007 default deny). Overpayment allow-workflow remains US-015.
 */
export async function recordManualPayment(
  actor: AuthorizationPrincipal | null,
  input: unknown,
  deps: PaymentServiceDependencies = createDefaultPaymentServiceDependencies(),
): Promise<PaymentServiceResult<PaymentRecord>> {
  try {
    assertPermission(actor, "payment.manual.record");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsed = paymentManualRecordSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, status: 400, error: PAYMENT_INVALID_INPUT };
    }

    const providerCheck = assertManualProviderPath(deps);
    if (!providerCheck.ok) {
      return providerCheck;
    }

    const invoice = await deps.invoices.getInvoiceById(parsed.data.invoiceId);
    if (!invoice) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }

    const scope = await enforceTransactionalCompanyScopeOf(actor, invoice.companyId, deps);
    if (!scope.ok) {
      return scope;
    }

    if (!canViewPayment(actor, { companyId: invoice.companyId }, invoice)) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }

    if (!isCollectibleInvoiceStatus(invoice.status)) {
      return { ok: false, status: 400, error: PAYMENT_INVOICE_NOT_PAYABLE };
    }

    const invoiceCurrency = await deps.currencies.findByCode(invoice.currencyCode);
    const invoicePrecision = invoiceCurrency?.decimalPrecision ?? 2;

    let applied;
    try {
      applied = moneyDecimal(parsed.data.invoiceAmountApplied);
    } catch {
      return { ok: false, status: 400, error: PAYMENT_INVALID_INPUT };
    }
    if (!applied.gt(0)) {
      return { ok: false, status: 400, error: PAYMENT_AMOUNT_NOT_POSITIVE };
    }
    const invoiceAmountApplied = toDecimalString(roundMoney(applied, invoicePrecision));

    const existingPayments = await deps.payments.listPayments({
      companyIds: [invoice.companyId],
      invoiceId: invoice.id,
    });
    assertManualPaymentWithinOpenBalance({
      invoiceTotal: invoice.invoiceTotal,
      invoiceCurrencyCode: invoice.currencyCode,
      invoiceDecimalPrecision: invoicePrecision,
      invoiceAmountApplied,
      existingPayments,
      processorFeeAmount: parsed.data.processorFeeAmount,
      actualReceivedAmount: parsed.data.actualReceivedAmount,
    });

    const created = await createPendingPayment(
      actor,
      {
        invoiceId: invoice.id,
        methodCode: "MANUAL",
        invoiceAmountApplied,
        settlementCurrencyCode: parsed.data.settlementCurrencyCode,
        paymentDate: parsed.data.paymentDate,
        externalTransactionId: parsed.data.externalTransactionId,
        source: "MANUAL",
        notes: parsed.data.notes,
        processorFeeAmount: parsed.data.processorFeeAmount,
        actualReceivedAmount: parsed.data.actualReceivedAmount,
      },
      deps,
    );
    if (!created.ok) {
      return created;
    }

    const confirmed = await confirmPayment(actor, created.data.id, deps);
    if (!confirmed.ok) {
      return confirmed;
    }

    logger.info(
      {
        event: "payments.manual_recorded",
        actorUserId: actor.userId,
        paymentId: confirmed.data.id,
        invoiceId: confirmed.data.invoiceId,
        companyId: confirmed.data.companyId,
        status: confirmed.data.status,
      },
      "Manual payment recorded",
    );

    return { ok: true, data: confirmed.data };
  } catch (error) {
    return toPaymentError(error, "write");
  }
}

export async function confirmPayment(
  actor: AuthorizationPrincipal | null,
  paymentId: string,
  deps: PaymentServiceDependencies = createDefaultPaymentServiceDependencies(),
): Promise<PaymentServiceResult<PaymentRecord>> {
  try {
    assertPermission(actor, "payment.manual.record");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsedId = paymentIdSchema.safeParse(paymentId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: PAYMENT_NOT_FOUND };
    }

    const payment = await deps.payments.getPaymentById(parsedId.data);
    if (!payment) {
      return { ok: false, status: 404, error: PAYMENT_NOT_FOUND };
    }

    const invoiceResult = await loadVisibleInvoiceForPayment(actor, payment, deps);
    if (!invoiceResult.ok) {
      return invoiceResult;
    }

    assertPaymentStatusTransition(payment.status, "SUCCESSFUL");
    assertConfirmedFinancialFieldsUnchanged(payment, {});

    const invoice = invoiceResult.data;
    const invoiceCurrency = await deps.currencies.findByCode(invoice.currencyCode);
    const invoicePrecision = invoiceCurrency?.decimalPrecision ?? 2;
    const existingPayments = await deps.payments.listPayments({
      companyIds: [payment.companyId],
      invoiceId: payment.invoiceId,
    });
    try {
      assertPaymentWithinOpenBalance({
        invoiceTotal: invoice.invoiceTotal,
        invoiceCurrencyCode: invoice.currencyCode,
        invoiceDecimalPrecision: invoicePrecision,
        invoiceAmountApplied: payment.invoiceAmountApplied,
        existingPayments,
        processorFeeAmount: payment.processorFeeAmount,
        actualReceivedAmount: payment.actualReceivedAmount,
      });
    } catch (error) {
      if (error instanceof Error && error.message === PAYMENT_EXCEEDS_OPEN_BALANCE) {
        return { ok: false, status: 400, error: PAYMENT_EXCEEDS_OPEN_BALANCE };
      }
      throw error;
    }

    let snapshotPatch: {
      readonly rateEffectiveAt?: Date;
      readonly rateVersionId?: string | null;
    } = {};

    if (!isConversionSnapshotComplete(payment)) {
      if (isCrossCurrencyPayment(payment)) {
        const rateResult = await resolveRateOf(
          deps,
          payment.invoiceCurrencyCode,
          payment.settlementCurrencyCode,
          payment.paymentDate,
        );
        if (!rateResult.ok) {
          return { ok: false, status: 400, error: FIXED_RATE_MISSING_FOR_CONVERSION };
        }
        snapshotPatch = confirmSnapshotLock(payment, {
          rateEffectiveAt: snapshotRateEffectiveAt({
            rateSource: "ADMIN_FIXED_RATE",
            paymentDate: payment.paymentDate,
            rateValidFrom: rateResult.validFrom,
          }),
          rateVersionId: rateResult.rateVersionId,
        });
      } else {
        snapshotPatch = {
          rateEffectiveAt: payment.rateEffectiveAt ?? payment.paymentDate,
          rateVersionId: payment.rateVersionId,
        };
      }
    }

    const receivedAt = nowOf(deps);
    const updated = await deps.payments.updatePaymentLifecycle(payment.id, payment.status, {
      status: "SUCCESSFUL",
      receivedAt,
      confirmedByUserId: actor.userId,
      ...snapshotPatch,
    });
    if (!updated) {
      return { ok: false, status: 400, error: PAYMENT_ILLEGAL_TRANSITION };
    }

    const settlementCurrency = await deps.currencies.findByCode(updated.settlementCurrencyCode);
    assertProcessorFeeExcludedFromSettlement(updated, settlementCurrency?.decimalPrecision ?? 2);
    assertReconciliationExcludedFromFinancialFormulas({
      invoiceAmountApplied: updated.invoiceAmountApplied,
      invoiceCurrencyCode: updated.invoiceCurrencyCode,
      settlementCurrencyCode: updated.settlementCurrencyCode,
      fixedConversionRate: updated.fixedConversionRate,
      settlementDecimalPrecision: settlementCurrency?.decimalPrecision ?? 2,
      convertedSettlementAmount: updated.convertedSettlementAmount,
      processorFeeAmount: updated.processorFeeAmount,
      actualReceivedAmount: updated.actualReceivedAmount,
      invoiceTotal: invoice.invoiceTotal,
      invoiceDecimalPrecision: invoicePrecision,
      confirmedApplications: [updated.invoiceAmountApplied],
    });
    assertConfirmedFinancialFieldsUnchanged(updated, {
      invoiceAmountApplied: payment.invoiceAmountApplied,
      convertedSettlementAmount: payment.convertedSettlementAmount,
      fixedConversionRate: payment.fixedConversionRate,
      processorFeeAmount: payment.processorFeeAmount,
      actualReceivedAmount: payment.actualReceivedAmount,
      invoiceCurrencyCode: payment.invoiceCurrencyCode,
      settlementCurrencyCode: payment.settlementCurrencyCode,
    });

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor.userId,
        companyId: updated.companyId,
        entityType: AuditEntityTypes.PAYMENT,
        entityId: updated.id,
        action: AuditActions.PAYMENT_CONFIRMED,
        oldValues: { status: payment.status },
        newValues: {
          status: updated.status,
          receivedAt: updated.receivedAt?.toISOString() ?? null,
          confirmedByUserId: updated.confirmedByUserId,
          invoiceAmountApplied: updated.invoiceAmountApplied,
          invoiceCurrencyCode: updated.invoiceCurrencyCode,
          settlementCurrencyCode: updated.settlementCurrencyCode,
          fixedConversionRate: updated.fixedConversionRate,
          rateSource: updated.rateSource,
          rateVersionId: updated.rateVersionId,
          rateEffectiveAt: updated.rateEffectiveAt?.toISOString() ?? null,
          convertedSettlementAmount: updated.convertedSettlementAmount,
          processorFeeAmount: updated.processorFeeAmount,
          actualReceivedAmount: updated.actualReceivedAmount,
        },
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "payments.confirmed",
        actorUserId: actor.userId,
        paymentId: updated.id,
        invoiceId: updated.invoiceId,
        companyId: updated.companyId,
      },
      "Payment confirmed",
    );

    await allocateAfterSuccessfulPayment(
      updated,
      { actorType: "USER", actorUserId: actor.userId },
      deps,
    );

    await emitPaymentOperationalNotification("PAYMENT_SUCCESS", updated, deps);

    return { ok: true, data: updated };
  } catch (error) {
    return toPaymentError(error, "write");
  }
}

export async function failPayment(
  actor: AuthorizationPrincipal | null,
  paymentId: string,
  deps: PaymentServiceDependencies = createDefaultPaymentServiceDependencies(),
): Promise<PaymentServiceResult<PaymentRecord>> {
  try {
    assertPermission(actor, "payment.manual.record");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsedId = paymentIdSchema.safeParse(paymentId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: PAYMENT_NOT_FOUND };
    }

    const payment = await deps.payments.getPaymentById(parsedId.data);
    if (!payment) {
      return { ok: false, status: 404, error: PAYMENT_NOT_FOUND };
    }

    const invoiceResult = await loadVisibleInvoiceForPayment(actor, payment, deps);
    if (!invoiceResult.ok) {
      return invoiceResult;
    }

    assertPaymentStatusTransition(payment.status, "FAILED");

    const updated = await deps.payments.updatePaymentLifecycle(payment.id, payment.status, {
      status: "FAILED",
    });
    if (!updated) {
      return { ok: false, status: 400, error: PAYMENT_ILLEGAL_TRANSITION };
    }

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor.userId,
        companyId: updated.companyId,
        entityType: AuditEntityTypes.PAYMENT,
        entityId: updated.id,
        action: AuditActions.PAYMENT_FAILED,
        oldValues: { status: payment.status },
        newValues: { status: updated.status },
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "payments.failed",
        actorUserId: actor.userId,
        paymentId: updated.id,
        invoiceId: updated.invoiceId,
        companyId: updated.companyId,
      },
      "Payment marked failed",
    );

    await emitPaymentOperationalNotification("PAYMENT_FAILED", updated, deps);

    return { ok: true, data: updated };
  } catch (error) {
    return toPaymentError(error, "write");
  }
}

/**
 * Apply a verified gateway webhook status to an existing PENDING payment (TASK-053).
 * Signature verification is the authorization boundary — no user RBAC.
 * Does not create payments (TASK-058) and does not rewrite confirmed financial fields.
 * SUCCESSFUL confirmation triggers invoice allocation (TASK-060).
 */
export async function applyGatewayWebhookPaymentStatus(
  input: {
    readonly companyId: string;
    readonly methodCode: PaymentMethodCode;
    readonly externalTransactionId: string;
    readonly status: PaymentStatus;
    readonly correlationId: string;
  },
  deps: PaymentServiceDependencies = createDefaultPaymentServiceDependencies(),
): Promise<
  PaymentServiceResult<{
    readonly payment: PaymentRecord | null;
    readonly outcome: "confirmed" | "failed" | "already_terminal" | "pending_noop" | "not_found";
  }>
> {
  try {
    if (input.status !== "SUCCESSFUL" && input.status !== "FAILED" && input.status !== "PENDING") {
      return { ok: false, status: 400, error: PAYMENT_INVALID_INPUT };
    }

    const payment = await deps.payments.getPaymentByExternalTransaction({
      companyId: input.companyId,
      methodCode: input.methodCode,
      externalTransactionId: input.externalTransactionId,
    });

    if (!payment) {
      return { ok: true, data: { payment: null, outcome: "not_found" } };
    }

    if (payment.companyId !== input.companyId) {
      return { ok: true, data: { payment: null, outcome: "not_found" } };
    }

    if (payment.status === "SUCCESSFUL" || payment.status === "FAILED") {
      return { ok: true, data: { payment, outcome: "already_terminal" } };
    }

    if (input.status === "PENDING") {
      return { ok: true, data: { payment, outcome: "pending_noop" } };
    }

    if (payment.status !== "PENDING") {
      return { ok: false, status: 400, error: PAYMENT_ILLEGAL_TRANSITION };
    }

    assertPaymentStatusTransition(payment.status, input.status);
    assertConfirmedFinancialFieldsUnchanged(payment, {});

    if (input.status === "SUCCESSFUL") {
      const invoice = await deps.invoices.getInvoiceById(payment.invoiceId);
      if (!invoice || invoice.companyId !== payment.companyId) {
        return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
      }
      const invoiceCurrency = await deps.currencies.findByCode(invoice.currencyCode);
      const invoicePrecision = invoiceCurrency?.decimalPrecision ?? 2;
      const existingPayments = await deps.payments.listPayments({
        companyIds: [payment.companyId],
        invoiceId: payment.invoiceId,
      });
      try {
        assertPaymentWithinOpenBalance({
          invoiceTotal: invoice.invoiceTotal,
          invoiceCurrencyCode: invoice.currencyCode,
          invoiceDecimalPrecision: invoicePrecision,
          invoiceAmountApplied: payment.invoiceAmountApplied,
          existingPayments,
          processorFeeAmount: payment.processorFeeAmount,
          actualReceivedAmount: payment.actualReceivedAmount,
        });
      } catch (error) {
        if (error instanceof Error && error.message === PAYMENT_EXCEEDS_OPEN_BALANCE) {
          return { ok: false, status: 400, error: PAYMENT_EXCEEDS_OPEN_BALANCE };
        }
        throw error;
      }

      let snapshotPatch: {
        readonly rateEffectiveAt?: Date;
        readonly rateVersionId?: string | null;
      } = {};

      if (!isConversionSnapshotComplete(payment)) {
        if (isCrossCurrencyPayment(payment)) {
          const rateResult = await resolveRateOf(
            deps,
            payment.invoiceCurrencyCode,
            payment.settlementCurrencyCode,
            payment.paymentDate,
          );
          if (!rateResult.ok) {
            return { ok: false, status: 400, error: FIXED_RATE_MISSING_FOR_CONVERSION };
          }
          snapshotPatch = confirmSnapshotLock(payment, {
            rateEffectiveAt: snapshotRateEffectiveAt({
              rateSource: "ADMIN_FIXED_RATE",
              paymentDate: payment.paymentDate,
              rateValidFrom: rateResult.validFrom,
            }),
            rateVersionId: rateResult.rateVersionId,
          });
        } else {
          snapshotPatch = {
            rateEffectiveAt: payment.rateEffectiveAt ?? payment.paymentDate,
            rateVersionId: payment.rateVersionId,
          };
        }
      }

      const receivedAt = nowOf(deps);
      const updated = await deps.payments.updatePaymentLifecycle(payment.id, payment.status, {
        status: "SUCCESSFUL",
        receivedAt,
        confirmedByUserId: null,
        ...snapshotPatch,
      });
      if (!updated) {
        // Concurrent webhook/confirm won the race — treat as idempotent terminal.
        const again = await deps.payments.getPaymentById(payment.id);
        if (again && (again.status === "SUCCESSFUL" || again.status === "FAILED")) {
          return { ok: true, data: { payment: again, outcome: "already_terminal" } };
        }
        return { ok: false, status: 400, error: PAYMENT_ILLEGAL_TRANSITION };
      }

      await recordAuditEventRequired(
        {
          actorType: "WEBHOOK",
          actorUserId: null,
          companyId: updated.companyId,
          entityType: AuditEntityTypes.PAYMENT,
          entityId: updated.id,
          action: AuditActions.PAYMENT_CONFIRMED,
          correlationId: input.correlationId,
          oldValues: { status: payment.status },
          newValues: {
            status: updated.status,
            receivedAt: updated.receivedAt?.toISOString() ?? null,
            source: updated.source,
            externalTransactionId: updated.externalTransactionId,
          },
        },
        auditWriterOf(deps),
      );

      logger.info(
        {
          event: "payments.confirmed",
          paymentId: updated.id,
          invoiceId: updated.invoiceId,
          companyId: updated.companyId,
          correlationId: input.correlationId,
          via: "gateway_webhook",
        },
        "Payment confirmed via gateway webhook",
      );

      await allocateAfterSuccessfulPayment(
        updated,
        {
          actorType: "WEBHOOK",
          actorUserId: null,
          correlationId: input.correlationId,
        },
        deps,
      );

      await emitPaymentOperationalNotification("PAYMENT_SUCCESS", updated, deps);

      return { ok: true, data: { payment: updated, outcome: "confirmed" } };
    }

    const updated = await deps.payments.updatePaymentLifecycle(payment.id, payment.status, {
      status: "FAILED",
    });
    if (!updated) {
      const again = await deps.payments.getPaymentById(payment.id);
      if (again && (again.status === "SUCCESSFUL" || again.status === "FAILED")) {
        return { ok: true, data: { payment: again, outcome: "already_terminal" } };
      }
      return { ok: false, status: 400, error: PAYMENT_ILLEGAL_TRANSITION };
    }

    await recordAuditEventRequired(
      {
        actorType: "WEBHOOK",
        actorUserId: null,
        companyId: updated.companyId,
        entityType: AuditEntityTypes.PAYMENT,
        entityId: updated.id,
        action: AuditActions.PAYMENT_FAILED,
        correlationId: input.correlationId,
        oldValues: { status: payment.status },
        newValues: { status: updated.status },
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "payments.failed",
        paymentId: updated.id,
        invoiceId: updated.invoiceId,
        companyId: updated.companyId,
        correlationId: input.correlationId,
        via: "gateway_webhook",
      },
      "Payment marked failed via gateway webhook",
    );

    await emitPaymentOperationalNotification("PAYMENT_FAILED", updated, deps);

    return { ok: true, data: { payment: updated, outcome: "failed" } };
  } catch (error) {
    return toPaymentError(error, "write");
  }
}

function toPaymentError(
  error: unknown,
  kind: "read" | "write" = "write",
): {
  ok: false;
  status: 400 | 401 | 403 | 404 | 503;
  error: string;
} {
  if (error instanceof AuthorizationError) {
    return {
      ok: false,
      status: 403,
      error: kind === "write" ? PAYMENT_RECORD_FORBIDDEN : GENERIC_FORBIDDEN,
    };
  }
  if (error instanceof Error) {
    if (
      error.message === PAYMENT_ILLEGAL_TRANSITION ||
      error.message === PAYMENT_CONFIRMED_IMMUTABLE ||
      error.message === PAYMENT_INVOICE_NOT_PAYABLE ||
      error.message === PAYMENT_FEE_MUST_NOT_AFFECT_SETTLEMENT ||
      error.message === PAYMENT_FEE_MUST_NOT_AFFECT_BALANCE ||
      error.message === PAYMENT_EXCEEDS_OPEN_BALANCE ||
      error.message === FIXED_RATE_MISSING_FOR_CONVERSION
    ) {
      return { ok: false, status: 400, error: error.message };
    }
  }

  logger.error(
    {
      event: "payments.unavailable",
      err: error instanceof Error ? error.message : "unknown",
    },
    "Payment operation failed",
  );
  return { ok: false, status: 503, error: PAYMENT_UNAVAILABLE };
}
