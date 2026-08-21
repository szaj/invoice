import "server-only";

import { logger } from "@/lib/logger";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import { AuthorizationError } from "@/domain/authz/errors";
import { AuditActions, AuditEntityTypes } from "@/domain/audit/types";
import { canViewInvoice } from "@/domain/invoices/access";
import {
  buildInvoicePdfRenderModel,
  invoicePdfStorageKey,
  INVOICE_PDF_CONTENT_TYPE,
  INVOICE_PDF_FORBIDDEN,
  INVOICE_PDF_GENERATION_FAILED,
  INVOICE_PDF_NOT_FOUND,
  INVOICE_PDF_PAGE_SIZES,
  INVOICE_PDF_UNAVAILABLE,
  INVOICE_PDF_VERSION_REQUIRED,
  type InvoicePdfFileRecord,
  type InvoicePdfPageSize,
} from "@/domain/invoices/pdf";
import { invoiceIdSchema } from "@/domain/invoices/schema";
import { INVOICE_NOT_FOUND } from "@/domain/invoices/types";
import {
  getAuditWriter,
  recordAuditEventRequired,
  type AuditWriter,
} from "@/server/audit/audit-service";
import { PrismaCompanyBrandingStore } from "@/server/companies/branding-repository";
import { PrismaCompanyStore } from "@/server/companies/company-repository";
import { createStorageService } from "@/server/storage/create-storage-service";
import type { StorageService } from "@/server/storage/storage-service";
import { PrismaCustomerStore } from "@/server/customers/customer-repository";
import { PrismaInvoiceFileStore } from "@/server/invoices/invoice-file-repository";
import { PrismaInvoiceVersionStore } from "@/server/invoices/invoice-version-repository";
import { renderInvoicePdfBytes } from "@/server/invoices/invoice-pdf-render";
import { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";
import type { InvoicePdfJobDispatcher } from "@/server/invoices/invoice-pdf-queue";

export type InvoicePdfResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 403 | 404 | 503; error: string };

export interface InvoicePdfDependencies {
  readonly invoices: Pick<PrismaInvoiceStore, "getInvoiceById">;
  readonly versions: Pick<PrismaInvoiceVersionStore, "listByInvoiceId">;
  readonly files: Pick<
    PrismaInvoiceFileStore,
    "getById" | "getByInvoiceVersionId" | "createFile" | "listByInvoiceId"
  >;
  readonly companies: Pick<PrismaCompanyStore, "getCompanyById">;
  readonly branding: Pick<PrismaCompanyBrandingStore, "getBrandingByCompanyId">;
  readonly customers: Pick<PrismaCustomerStore, "getCustomerById">;
  readonly storage?: StorageService;
  readonly auditWriter?: AuditWriter;
  readonly dispatcher?: InvoicePdfJobDispatcher;
}

export function createDefaultInvoicePdfDependencies(): InvoicePdfDependencies {
  return {
    invoices: new PrismaInvoiceStore(),
    versions: new PrismaInvoiceVersionStore(),
    files: new PrismaInvoiceFileStore(),
    companies: new PrismaCompanyStore(),
    branding: new PrismaCompanyBrandingStore(),
    customers: new PrismaCustomerStore(),
  };
}

function storageOf(deps: InvoicePdfDependencies): StorageService {
  return deps.storage ?? createStorageService();
}

function auditWriterOf(deps: InvoicePdfDependencies): AuditWriter {
  return deps.auditWriter ?? getAuditWriter();
}

function parsePageSize(value: unknown): InvoicePdfPageSize {
  if (typeof value === "string" && (INVOICE_PDF_PAGE_SIZES as readonly string[]).includes(value)) {
    return value as InvoicePdfPageSize;
  }
  return "A4";
}

function toLogoDataUri(mimeType: string, body: Uint8Array): string {
  const base64 = Buffer.from(body).toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Generate and store an invoice PDF once per version (TASK-039).
 * Uses immutable invoice_versions snapshot for financial content.
 * If a PDF already exists for the version, returns it without regenerating (ADR-013).
 */
export async function generateInvoicePdf(
  actor: AuthorizationPrincipal | null,
  invoiceId: string,
  input: { readonly invoiceVersionId?: string | null; readonly pageSize?: unknown } = {},
  deps: InvoicePdfDependencies = createDefaultInvoicePdfDependencies(),
): Promise<InvoicePdfResult<InvoicePdfFileRecord & { readonly reusedExisting: boolean }>> {
  try {
    assertPermission(actor, "invoice.create");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsedId = invoiceIdSchema.safeParse(invoiceId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }

    const invoice = await deps.invoices.getInvoiceById(parsedId.data);
    if (!invoice) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }

    assertCompanyAccess(actor, invoice.companyId);
    if (!canViewInvoice(actor, invoice)) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }

    const versions = await deps.versions.listByInvoiceId(invoice.id);
    if (versions.length === 0) {
      return { ok: false, status: 400, error: INVOICE_PDF_VERSION_REQUIRED };
    }

    const version =
      input.invoiceVersionId != null && input.invoiceVersionId.length > 0
        ? versions.find((row) => row.id === input.invoiceVersionId)
        : versions[0];
    if (!version) {
      return { ok: false, status: 404, error: INVOICE_PDF_VERSION_REQUIRED };
    }

    const existing = await deps.files.getByInvoiceVersionId(version.id);
    if (existing) {
      return { ok: true, data: { ...existing, reusedExisting: true } };
    }

    const pageSize = parsePageSize(input.pageSize);
    const [company, branding, customer] = await Promise.all([
      deps.companies.getCompanyById(invoice.companyId),
      deps.branding.getBrandingByCompanyId(invoice.companyId),
      deps.customers.getCustomerById(invoice.customerId),
    ]);
    if (!company || !customer) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }

    let logoDataUri: string | null = null;
    if (branding?.logo) {
      const logoObject = await storageOf(deps).getObject(branding.logo.storageKey);
      if (logoObject) {
        logoDataUri = toLogoDataUri(logoObject.contentType, logoObject.body);
      }
    }

    const model = buildInvoicePdfRenderModel({
      pageSize,
      versionNo: version.versionNo,
      snapshot: version.snapshot,
      company: {
        displayName: branding?.displayName ?? company.displayName,
        legalName: company.legalName,
        email: branding?.email ?? company.email,
        phone: branding?.phone ?? company.phone,
        website: branding?.website ?? company.website,
        registrationTaxNumber: company.registrationTaxNumber,
        addressLine1: company.addressLine1,
        addressLine2: company.addressLine2,
        city: company.city,
        region: company.region,
        postalCode: company.postalCode,
        countryCode: company.countryCode,
        termsAndConditions: branding?.termsAndConditions ?? null,
        logoDataUri,
      },
      customer: {
        displayName: customer.displayName,
        contactPerson: customer.contactPerson,
        email: customer.email,
        phone: customer.phone,
        addressLine1: customer.addressLine1,
        addressLine2: customer.addressLine2,
        city: customer.city,
        region: customer.region,
        postalCode: customer.postalCode,
        countryCode: customer.countryCode,
        taxRegistrationId: customer.taxRegistrationId,
      },
    });

    let rendered;
    try {
      rendered = await renderInvoicePdfBytes(model);
    } catch (error) {
      logger.error(
        {
          event: "invoices.pdf_render_failed",
          invoiceId: invoice.id,
          invoiceVersionId: version.id,
          err: error instanceof Error ? error.message : "unknown",
        },
        "Invoice PDF render failed",
      );
      return { ok: false, status: 503, error: INVOICE_PDF_GENERATION_FAILED };
    }

    const storageKey = invoicePdfStorageKey({
      companyId: invoice.companyId,
      invoiceId: invoice.id,
      versionNo: version.versionNo,
    });

    try {
      await storageOf(deps).putObject({
        key: storageKey,
        body: rendered.bytes,
        contentType: INVOICE_PDF_CONTENT_TYPE,
      });
    } catch (error) {
      logger.error(
        {
          event: "invoices.pdf_store_failed",
          invoiceId: invoice.id,
          storageKey,
          err: error instanceof Error ? error.message : "unknown",
        },
        "Invoice PDF storage failed",
      );
      return { ok: false, status: 503, error: INVOICE_PDF_GENERATION_FAILED };
    }

    const file = await deps.files.createFile({
      invoiceId: invoice.id,
      invoiceVersionId: version.id,
      storageKey,
      checksumSha256: rendered.checksumSha256,
      byteSize: rendered.byteSize,
      pageSize,
      createdByUserId: actor.userId,
    });

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor.userId,
        companyId: invoice.companyId,
        entityType: AuditEntityTypes.INVOICE,
        entityId: invoice.id,
        action: AuditActions.INVOICE_PDF_GENERATED,
        newValues: {
          invoiceFileId: file.id,
          invoiceVersionId: version.id,
          versionNo: version.versionNo,
          storageKey: file.storageKey,
          checksumSha256: file.checksumSha256,
          byteSize: file.byteSize,
          pageSize: file.pageSize,
        },
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "invoices.pdf_generated",
        actorUserId: actor.userId,
        invoiceId: invoice.id,
        invoiceFileId: file.id,
        invoiceVersionId: version.id,
        versionNo: version.versionNo,
      },
      "Invoice PDF generated",
    );

    return { ok: true, data: { ...file, reusedExisting: false } };
  } catch (error) {
    return toPdfError(error);
  }
}

/**
 * Queueable entry point (ADR-005). Default path runs generation inline.
 * TASK-099 may swap in a BullMQ dispatcher without changing callers.
 * Does not claim success when generation fails.
 */
export async function enqueueInvoicePdfGeneration(
  actor: AuthorizationPrincipal | null,
  job: {
    readonly invoiceId: string;
    readonly invoiceVersionId?: string | null;
    readonly pageSize?: InvoicePdfPageSize;
  },
  deps: InvoicePdfDependencies = createDefaultInvoicePdfDependencies(),
): Promise<InvoicePdfResult<InvoicePdfFileRecord & { readonly reusedExisting: boolean }>> {
  const run = () =>
    generateInvoicePdf(
      actor,
      job.invoiceId,
      { invoiceVersionId: job.invoiceVersionId, pageSize: job.pageSize },
      deps,
    );

  if (!deps.dispatcher) {
    return run();
  }

  try {
    const dispatched = await deps.dispatcher.dispatch({
      invoiceId: job.invoiceId,
      invoiceVersionId: job.invoiceVersionId,
      actorUserId: actor?.userId ?? null,
      pageSize: job.pageSize,
    });
    if (dispatched.invoiceFileId) {
      const files = await deps.files.listByInvoiceId(job.invoiceId);
      const file = files.find((row) => row.id === dispatched.invoiceFileId);
      if (file) {
        return { ok: true, data: { ...file, reusedExisting: false } };
      }
    }
    return run();
  } catch (error) {
    logger.error(
      {
        event: "invoices.pdf_enqueue_failed",
        invoiceId: job.invoiceId,
        err: error instanceof Error ? error.message : "unknown",
      },
      "Invoice PDF enqueue/generate failed",
    );
    return {
      ok: false,
      status: 503,
      error: error instanceof Error ? error.message : INVOICE_PDF_GENERATION_FAILED,
    };
  }
}

export async function listInvoicePdfFiles(
  actor: AuthorizationPrincipal | null,
  invoiceId: string,
  deps: InvoicePdfDependencies = createDefaultInvoicePdfDependencies(),
): Promise<InvoicePdfResult<readonly InvoicePdfFileRecord[]>> {
  try {
    assertPermission(actor, "invoice.create");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsedId = invoiceIdSchema.safeParse(invoiceId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }

    const invoice = await deps.invoices.getInvoiceById(parsedId.data);
    if (!invoice) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }
    assertCompanyAccess(actor, invoice.companyId);
    if (!canViewInvoice(actor, invoice)) {
      return { ok: false, status: 403, error: INVOICE_PDF_FORBIDDEN };
    }

    const files = await deps.files.listByInvoiceId(invoice.id);
    return { ok: true, data: files };
  } catch (error) {
    return toPdfError(error);
  }
}

export type InvoicePdfDownloadPayload = {
  readonly file: InvoicePdfFileRecord;
  readonly bytes: Uint8Array;
  readonly filename: string;
  readonly disposition: "inline" | "attachment";
};

/**
 * Authorized PDF byte retrieval for preview/download (TASK-040).
 * Reads stored bytes from StorageService. Does not regenerate when a file row exists.
 * Missing storage object → 404 (does not silently rebuild from today's mutable data).
 */
export async function downloadInvoicePdf(
  actor: AuthorizationPrincipal | null,
  invoiceId: string,
  input: {
    readonly fileId: string;
    readonly disposition?: "inline" | "attachment";
  },
  deps: InvoicePdfDependencies = createDefaultInvoicePdfDependencies(),
): Promise<InvoicePdfResult<InvoicePdfDownloadPayload>> {
  try {
    assertPermission(actor, "invoice.create");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsedId = invoiceIdSchema.safeParse(invoiceId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }

    const parsedFileId = invoiceIdSchema.safeParse(input.fileId);
    if (!parsedFileId.success) {
      return { ok: false, status: 404, error: INVOICE_PDF_NOT_FOUND };
    }

    const invoice = await deps.invoices.getInvoiceById(parsedId.data);
    if (!invoice) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }

    assertCompanyAccess(actor, invoice.companyId);
    if (!canViewInvoice(actor, invoice)) {
      return { ok: false, status: 403, error: INVOICE_PDF_FORBIDDEN };
    }

    const file = await deps.files.getById(parsedFileId.data);
    if (!file || file.invoiceId !== invoice.id) {
      return { ok: false, status: 404, error: INVOICE_PDF_NOT_FOUND };
    }

    const object = await storageOf(deps).getObject(file.storageKey);
    if (!object) {
      return { ok: false, status: 404, error: INVOICE_PDF_NOT_FOUND };
    }

    const versions = await deps.versions.listByInvoiceId(invoice.id);
    const version = versions.find((row) => row.id === file.invoiceVersionId);
    const numberPart =
      version?.snapshot.invoiceNumber ?? invoice.invoiceNumber ?? invoice.id.slice(0, 8);
    const versionPart = version ? `v${version.versionNo}` : "pdf";
    const filename = `${numberPart}-${versionPart}.pdf`.replace(/[^\w.\-]+/g, "_");

    return {
      ok: true,
      data: {
        file,
        bytes: object.body,
        filename,
        disposition: input.disposition === "attachment" ? "attachment" : "inline",
      },
    };
  } catch (error) {
    return toPdfError(error);
  }
}

function toPdfError(error: unknown): {
  ok: false;
  status: 400 | 403 | 404 | 503;
  error: string;
} {
  if (error instanceof AuthorizationError) {
    return { ok: false, status: 403, error: INVOICE_PDF_FORBIDDEN };
  }
  logger.error(
    {
      event: "invoices.pdf_unavailable",
      err: error instanceof Error ? error.message : "unknown",
    },
    "Invoice PDF operation failed",
  );
  return { ok: false, status: 503, error: INVOICE_PDF_UNAVAILABLE };
}
