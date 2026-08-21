"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authorizePermission } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import type { CurrencyPickerOption } from "@/domain/currencies/selection";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { listSwitcherCompanies } from "@/server/company-context/accessible-companies";
import { loadCompanyContextForLayout } from "@/server/company-context/actions";
import { listCustomers } from "@/server/customers/customer-service";
import { listCurrenciesForNewDocument } from "@/server/currencies/currency-selection-service";
import {
  allocateNextInvoiceNumber,
  assignInvoiceNumber,
  rejectHandEditedInvoiceNumber,
} from "@/server/invoices/invoice-number-service";
import { cancelInvoice } from "@/server/invoices/invoice-cancel-service";
import {
  applyOverdueToInvoiceList,
  issueInvoice,
} from "@/server/invoices/invoice-lifecycle-service";
import { generateInvoicePdf, listInvoicePdfFiles } from "@/server/invoices/invoice-pdf-service";
import {
  listInvoiceVersions,
  updateIssuedInvoiceMetadata,
} from "@/server/invoices/invoice-version-service";
import {
  createDraftInvoice,
  getDraftInvoice,
  listDraftInvoices,
  updateDraftInvoice,
} from "@/server/invoices/invoice-draft-service";
import {
  listInvoiceLineItems,
  replaceDraftInvoiceLineItems,
} from "@/server/invoices/invoice-line-item-service";
import type { InvoiceStatus } from "@/domain/invoices/types";

export type InvoiceActionResult =
  { ok: true; message?: string; invoiceId?: string } | { ok: false; error: string };

export async function duplicateInvoiceAction(invoiceId: string): Promise<InvoiceActionResult> {
  const { duplicateInvoice } = await import("@/server/invoices/invoice-duplicate-service");
  const actor = await getRequestAuthorizationPrincipal();
  const result = await duplicateInvoice(actor, invoiceId);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${result.data.id}`);
  return {
    ok: true,
    message: "Draft invoice created from duplicate.",
    invoiceId: result.data.id,
  };
}

export async function createDraftInvoiceAction(input: unknown): Promise<InvoiceActionResult> {
  const handEdit = rejectHandEditedInvoiceNumber(input);
  if (handEdit) {
    return { ok: false, error: handEdit.error };
  }
  const actor = await getRequestAuthorizationPrincipal();
  const result = await createDraftInvoice(actor, input);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidatePath("/invoices");
  redirect(`/invoices/${result.data.id}`);
}

export async function updateDraftInvoiceAction(
  invoiceId: string,
  input: unknown,
): Promise<InvoiceActionResult> {
  const handEdit = rejectHandEditedInvoiceNumber(input);
  if (handEdit) {
    return { ok: false, error: handEdit.error };
  }
  const actor = await getRequestAuthorizationPrincipal();
  const result = await updateDraftInvoice(actor, invoiceId, input);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath(`/invoices/${invoiceId}/edit`);
  return { ok: true, message: "Draft invoice updated.", invoiceId };
}

export async function assignInvoiceNumberAction(invoiceId: string): Promise<InvoiceActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await assignInvoiceNumber(actor, invoiceId);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath(`/invoices/${invoiceId}/edit`);
  return {
    ok: true,
    message: `Invoice number ${result.data.invoiceNumber} assigned.`,
    invoiceId,
  };
}

/** Exposed for lifecycle/issue (TASK-036) and concurrency verification. */
export async function allocateNextInvoiceNumberAction(companyId: string) {
  const actor = await getRequestAuthorizationPrincipal();
  return allocateNextInvoiceNumber(actor, companyId);
}

export async function issueInvoiceAction(invoiceId: string): Promise<InvoiceActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await issueInvoice(actor, invoiceId);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath(`/invoices/${invoiceId}/edit`);
  return {
    ok: true,
    message: `Invoice ${result.data.invoiceNumber ?? invoiceId} issued.`,
    invoiceId,
  };
}

export async function cancelInvoiceAction(
  invoiceId: string,
  input: unknown,
): Promise<InvoiceActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await cancelInvoice(actor, invoiceId, input);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath(`/invoices/${invoiceId}/edit`);
  if (result.data.customerId) {
    revalidatePath(`/customers/${result.data.customerId}`);
  }
  return {
    ok: true,
    message: "Invoice cancelled.",
    invoiceId,
  };
}

export async function generateInvoicePdfAction(
  invoiceId: string,
  input: unknown = {},
): Promise<InvoiceActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const payload = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const result = await generateInvoicePdf(actor, invoiceId, {
    invoiceVersionId:
      typeof payload.invoiceVersionId === "string" ? payload.invoiceVersionId : null,
    pageSize: payload.pageSize,
  });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidatePath(`/invoices/${invoiceId}`);
  return {
    ok: true,
    message: result.data.reusedExisting
      ? "Invoice PDF already exists for this version."
      : "Invoice PDF generated.",
    invoiceId,
  };
}

export async function loadInvoicePdfFilesForUi(invoiceId: string) {
  const actor = await getRequestAuthorizationPrincipal();
  return listInvoicePdfFiles(actor, invoiceId);
}

export async function sendInvoiceEmailAction(
  invoiceId: string,
  input: unknown = {},
): Promise<InvoiceActionResult> {
  const { sendInvoiceEmail } = await import("@/server/invoices/invoice-email-service");
  const { parseEmailAddressList } = await import("@/domain/invoices/email");
  const actor = await getRequestAuthorizationPrincipal();
  const payload = input && typeof input === "object" ? (input as Record<string, unknown>) : {};

  const ccFromArray = Array.isArray(payload.cc)
    ? payload.cc.filter((value): value is string => typeof value === "string")
    : typeof payload.cc === "string"
      ? parseEmailAddressList(payload.cc)
      : [];
  const bccFromArray = Array.isArray(payload.bcc)
    ? payload.bcc.filter((value): value is string => typeof value === "string")
    : typeof payload.bcc === "string"
      ? parseEmailAddressList(payload.bcc)
      : [];

  const result = await sendInvoiceEmail(actor, invoiceId, {
    invoiceFileId: typeof payload.invoiceFileId === "string" ? payload.invoiceFileId : null,
    recipientOverride: typeof payload.recipient === "string" ? payload.recipient : null,
    cc: ccFromArray,
    bcc: bccFromArray,
    paymentLink: typeof payload.paymentLink === "string" ? payload.paymentLink : null,
    subjectOverride: typeof payload.subject === "string" ? payload.subject : null,
    bodyOverride: typeof payload.body === "string" ? payload.body : null,
  });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidatePath(`/invoices/${invoiceId}`);
  return {
    ok: true,
    message: `Invoice emailed to ${result.data.recipient}.`,
    invoiceId,
  };
}

export async function loadInvoiceEmailLogsForUi(invoiceId: string) {
  const { listInvoiceEmailLogs } = await import("@/server/invoices/invoice-email-service");
  const actor = await getRequestAuthorizationPrincipal();
  return listInvoiceEmailLogs(actor, invoiceId);
}

export async function loadInvoiceEmailComposeForUi(invoiceId: string) {
  const { prepareInvoiceEmailCompose } = await import("@/server/invoices/invoice-email-service");
  const actor = await getRequestAuthorizationPrincipal();
  return prepareInvoiceEmailCompose(actor, invoiceId);
}

export async function loadInvoiceVersionsForUi(invoiceId: string) {
  const actor = await getRequestAuthorizationPrincipal();
  return listInvoiceVersions(actor, invoiceId);
}

export async function updateIssuedInvoiceMetadataAction(
  invoiceId: string,
  input: unknown,
): Promise<InvoiceActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await updateIssuedInvoiceMetadata(actor, invoiceId, input);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  return { ok: true, message: "Invoice metadata updated.", invoiceId };
}

export async function loadDraftInvoicesForUi(
  query: { companyId?: string; status?: InvoiceStatus } = {},
) {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await listDraftInvoices(actor, {
    companyId: query.companyId,
    status: query.status ?? "DRAFT",
  });
  if (!result.ok || !actor) {
    return result;
  }
  const withOverdue = await applyOverdueToInvoiceList(actor, result.data);
  return { ok: true as const, data: withOverdue };
}

export async function loadDraftInvoiceForUi(invoiceId: string) {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await getDraftInvoice(actor, invoiceId);
  if (!result.ok || !actor) {
    return result;
  }
  const [refreshed] = await applyOverdueToInvoiceList(actor, [result.data]);
  return { ok: true as const, data: refreshed ?? result.data };
}

export async function loadInvoiceLineItemsForUi(invoiceId: string) {
  const actor = await getRequestAuthorizationPrincipal();
  return listInvoiceLineItems(actor, invoiceId);
}

export async function loadInvoiceCurrencyPrecision(currencyCode: string): Promise<number> {
  const { PrismaCurrencyStore } = await import("@/server/currencies/currency-repository");
  const currency = await new PrismaCurrencyStore().findByCode(currencyCode);
  return currency?.decimalPrecision ?? 2;
}

export async function replaceDraftInvoiceLineItemsAction(
  invoiceId: string,
  input: unknown,
): Promise<InvoiceActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await replaceDraftInvoiceLineItems(actor, invoiceId, input);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath(`/invoices/${invoiceId}/edit`);
  return { ok: true, message: "Line items saved.", invoiceId };
}

export async function loadInvoiceFormOptions(companyId?: string | null) {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "invoice.create").allowed) {
    return {
      ok: false as const,
      status: 403 as const,
      error: GENERIC_FORBIDDEN,
      companies: [] as Array<{ id: string; displayName: string }>,
      customers: [] as Array<{ id: string; displayName: string; companyIds: string[] }>,
      currencies: [] as CurrencyPickerOption[],
      defaultCompanyId: null as string | null,
      canCreate: false,
      canEditDraft: false,
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
        : (companies[0]?.id ?? null);

  const customersResult = await listCustomers(actor, {
    status: "ACTIVE",
    ...(selectedCompanyId ? { companyId: selectedCompanyId } : {}),
  });
  const customers = customersResult.ok
    ? customersResult.data.map((customer) => ({
        id: customer.id,
        displayName: customer.displayName,
        companyIds: [...customer.companyIds],
      }))
    : [];

  let currencies: CurrencyPickerOption[] = [];
  if (selectedCompanyId) {
    const currencyResult = await listCurrenciesForNewDocument(selectedCompanyId);
    if (currencyResult.ok) {
      currencies = [...currencyResult.data];
    }
  }

  return {
    ok: true as const,
    companies: companies.map((company) => ({
      id: company.id,
      displayName: company.displayName,
    })),
    customers,
    currencies,
    defaultCompanyId: selectedCompanyId,
    canCreate: authorizePermission(actor, "invoice.create").allowed,
    canEditDraft: authorizePermission(actor, "invoice.edit_draft").allowed,
  };
}

export async function loadInvoiceFormOptionsForCompanyAction(companyId: string) {
  return loadInvoiceFormOptions(companyId);
}
