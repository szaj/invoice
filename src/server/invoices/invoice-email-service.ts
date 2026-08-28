import "server-only";

import { logger } from "@/lib/logger";
import {
  assertPermission,
  authorizePermission,
  type AuthorizationPrincipal,
} from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import { AuthorizationError } from "@/domain/authz/errors";
import { AuditActions, AuditEntityTypes } from "@/domain/audit/types";
import { canViewInvoice } from "@/domain/invoices/access";
import {
  buildInvoiceEmailContent,
  isValidCustomerEmail,
  INVOICE_EMAIL_CC_BCC_PERMISSION,
  INVOICE_EMAIL_CC_FORBIDDEN,
  INVOICE_EMAIL_CC_INVALID,
  INVOICE_EMAIL_CUSTOMER_REQUIRED,
  INVOICE_EMAIL_FORBIDDEN,
  INVOICE_EMAIL_NOT_ISSUABLE,
  INVOICE_EMAIL_PDF_REQUIRED,
  INVOICE_EMAIL_SEND_FAILED,
  INVOICE_EMAIL_UNAVAILABLE,
  validateEmailAddressList,
  type EmailLogRecord,
  type InvoiceEmailComposeDefaults,
} from "@/domain/invoices/email";
import { invoiceIdSchema } from "@/domain/invoices/schema";
import { INVOICE_NOT_FOUND } from "@/domain/invoices/types";
import {
  getAuditWriter,
  recordAuditEventRequired,
  type AuditWriter,
} from "@/server/audit/audit-service";
import { PrismaCompanyBrandingStore } from "@/server/companies/branding-repository";
import { PrismaCompanyStore } from "@/server/companies/company-repository";
import { PrismaCustomerStore } from "@/server/customers/customer-repository";
import { createEmailService, type EmailService } from "@/server/email/email-service";
import { PrismaEmailLogStore } from "@/server/invoices/email-log-repository";
import { PrismaInvoiceFileStore } from "@/server/invoices/invoice-file-repository";
import type { InvoiceEmailJobDispatcher } from "@/server/invoices/invoice-email-queue";
import { isQueueEnabled } from "@/server/queue/config";
import { createInvoiceEmailBullMqDispatcher } from "@/server/queue/dispatchers";
import {
  generateInvoicePdf,
  createDefaultInvoicePdfDependencies,
} from "@/server/invoices/invoice-pdf-service";
import { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";
import { PrismaInvoiceVersionStore } from "@/server/invoices/invoice-version-repository";
import { createStorageService } from "@/server/storage/create-storage-service";
import type { StorageService } from "@/server/storage/storage-service";
import { getEnv } from "@/config/env";
import { emitOperationalNotification } from "@/server/notifications/notification-service";

export type InvoiceEmailResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 403 | 404 | 503; error: string };

export interface InvoiceEmailDependencies {
  readonly invoices: Pick<PrismaInvoiceStore, "getInvoiceById">;
  readonly versions: Pick<PrismaInvoiceVersionStore, "listByInvoiceId">;
  readonly files: Pick<PrismaInvoiceFileStore, "getById" | "listByInvoiceId">;
  readonly customers: Pick<PrismaCustomerStore, "getCustomerById">;
  readonly companies: Pick<PrismaCompanyStore, "getCompanyById">;
  readonly branding: Pick<PrismaCompanyBrandingStore, "getBrandingByCompanyId">;
  readonly emailLogs: Pick<PrismaEmailLogStore, "create" | "listByInvoiceId">;
  readonly storage?: StorageService;
  readonly emailService?: EmailService;
  readonly auditWriter?: AuditWriter;
  readonly dispatcher?: InvoiceEmailJobDispatcher;
}

export function createDefaultInvoiceEmailDependencies(): InvoiceEmailDependencies {
  return {
    invoices: new PrismaInvoiceStore(),
    versions: new PrismaInvoiceVersionStore(),
    files: new PrismaInvoiceFileStore(),
    customers: new PrismaCustomerStore(),
    companies: new PrismaCompanyStore(),
    branding: new PrismaCompanyBrandingStore(),
    emailLogs: new PrismaEmailLogStore(),
  };
}

function storageOf(deps: InvoiceEmailDependencies): StorageService {
  return deps.storage ?? createStorageService();
}

function emailServiceOf(deps: InvoiceEmailDependencies): EmailService {
  return deps.emailService ?? createEmailService();
}

function auditWriterOf(deps: InvoiceEmailDependencies): AuditWriter {
  return deps.auditWriter ?? getAuditWriter();
}

function dispatcherOf(deps: InvoiceEmailDependencies): InvoiceEmailJobDispatcher | undefined {
  if (deps.dispatcher) {
    return deps.dispatcher;
  }
  if (!isQueueEnabled()) {
    return undefined;
  }
  return createInvoiceEmailBullMqDispatcher();
}

/**
 * Email an invoice PDF through EmailService (TASK-041 / ADR-007 / BR-017).
 * Attaches a stored versioned PDF. Does not claim success when PDF or send fails.
 * Email failure does not change invoice status.
 */
export async function sendInvoiceEmail(
  actor: AuthorizationPrincipal | null,
  invoiceId: string,
  input: {
    readonly invoiceFileId?: string | null;
    readonly recipientOverride?: string | null;
    readonly cc?: readonly string[] | null;
    readonly bcc?: readonly string[] | null;
    readonly paymentLink?: string | null;
    readonly subjectOverride?: string | null;
    readonly bodyOverride?: string | null;
  } = {},
  deps: InvoiceEmailDependencies = createDefaultInvoiceEmailDependencies(),
): Promise<InvoiceEmailResult<EmailLogRecord>> {
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
      return { ok: false, status: 403, error: INVOICE_EMAIL_FORBIDDEN };
    }

    if (invoice.status === "DRAFT") {
      return { ok: false, status: 400, error: INVOICE_EMAIL_NOT_ISSUABLE };
    }

    const customer = await deps.customers.getCustomerById(invoice.customerId);
    if (!customer) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }

    const recipientRaw = input.recipientOverride?.trim() || customer.email;
    if (!isValidCustomerEmail(recipientRaw)) {
      return { ok: false, status: 400, error: INVOICE_EMAIL_CUSTOMER_REQUIRED };
    }
    const recipient = recipientRaw.trim();

    const ccRaw = [...(input.cc ?? [])];
    const bccRaw = [...(input.bcc ?? [])];
    let cc: string[] = [];
    let bcc: string[] = [];
    if (ccRaw.length > 0 || bccRaw.length > 0) {
      if (!authorizePermission(actor, INVOICE_EMAIL_CC_BCC_PERMISSION).allowed) {
        return { ok: false, status: 403, error: INVOICE_EMAIL_CC_FORBIDDEN };
      }
      const ccParsed = validateEmailAddressList(ccRaw);
      const bccParsed = validateEmailAddressList(bccRaw);
      if (!ccParsed.ok || !bccParsed.ok) {
        return { ok: false, status: 400, error: INVOICE_EMAIL_CC_INVALID };
      }
      cc = ccParsed.emails;
      bcc = bccParsed.emails;
    }

    const versions = await deps.versions.listByInvoiceId(invoice.id);
    if (versions.length === 0) {
      return { ok: false, status: 400, error: INVOICE_EMAIL_NOT_ISSUABLE };
    }

    let file =
      input.invoiceFileId != null && input.invoiceFileId.length > 0
        ? await deps.files.getById(input.invoiceFileId)
        : ((await deps.files.listByInvoiceId(invoice.id))[0] ?? null);

    if (file && file.invoiceId !== invoice.id) {
      return { ok: false, status: 404, error: INVOICE_EMAIL_PDF_REQUIRED };
    }

    if (!file) {
      const generated = await generateInvoicePdf(
        actor,
        invoice.id,
        { invoiceVersionId: versions[0]?.id ?? null },
        {
          ...createDefaultInvoicePdfDependencies(),
          storage: storageOf(deps),
          auditWriter: auditWriterOf(deps),
        },
      );
      if (!generated.ok) {
        return { ok: false, status: 400, error: INVOICE_EMAIL_PDF_REQUIRED };
      }
      file = generated.data;
    }

    const pdfObject = await storageOf(deps).getObject(file.storageKey);
    if (!pdfObject) {
      return { ok: false, status: 400, error: INVOICE_EMAIL_PDF_REQUIRED };
    }

    const [company, branding] = await Promise.all([
      deps.companies.getCompanyById(invoice.companyId),
      deps.branding.getBrandingByCompanyId(invoice.companyId),
    ]);
    if (!company) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }

    const version = versions.find((row) => row.id === file!.invoiceVersionId) ?? versions[0]!;
    const snapshot = version.snapshot;
    const paymentLink = input.paymentLink?.trim()
      ? `Payment link: ${input.paymentLink.trim()}`
      : "Payment link: (not available yet)";

    const content = buildInvoiceEmailContent({
      templateReference: branding?.emailTemplateReference ?? null,
      subjectOverride: input.subjectOverride,
      bodyOverride: input.bodyOverride,
      fields: {
        company_name: branding?.displayName ?? company.displayName,
        customer_name: customer.displayName,
        invoice_number: snapshot.invoiceNumber ?? invoice.invoiceNumber ?? invoice.id.slice(0, 8),
        invoice_date: snapshot.invoiceDate,
        due_date: snapshot.dueDate,
        invoice_currency: snapshot.currencyCode,
        invoice_total: snapshot.invoiceTotal,
        amount_paid: snapshot.confirmedPaidAmount,
        balance_due: snapshot.outstandingAmount,
        payment_link: paymentLink,
        company_email: branding?.email ?? company.email ?? "",
        company_phone: branding?.phone ?? company.phone ?? "",
      },
    });

    const filename = `${snapshot.invoiceNumber ?? "invoice"}-v${version.versionNo}.pdf`.replace(
      /[^\w.\-]+/g,
      "_",
    );

    const replyTo = branding?.email ?? company.email ?? null;
    const fromDisplay = (branding?.displayName ?? company.displayName).replaceAll('"', "");
    const envFrom = getEnv().EMAIL_FROM;
    const fromHeader = envFrom ? `"${fromDisplay}" <${envFrom}>` : undefined;

    try {
      const sent = await emailServiceOf(deps).send({
        to: recipient,
        from: fromHeader,
        replyTo,
        cc: cc.length > 0 ? cc : undefined,
        bcc: bcc.length > 0 ? bcc : undefined,
        subject: content.subject,
        text: content.text,
        attachments: [
          {
            filename,
            contentType: file.contentType,
            content: pdfObject.body,
          },
        ],
      });

      const log = await deps.emailLogs.create({
        companyId: invoice.companyId,
        invoiceId: invoice.id,
        invoiceFileId: file.id,
        recipient,
        subject: content.subject,
        status: "SENT",
        providerMessageId: sent.providerMessageId,
        errorMessage: null,
        retryable: false,
        sentByUserId: actor.userId,
      });

      await recordAuditEventRequired(
        {
          actorType: "USER",
          actorUserId: actor.userId,
          companyId: invoice.companyId,
          entityType: AuditEntityTypes.INVOICE,
          entityId: invoice.id,
          action: AuditActions.INVOICE_EMAILED,
          newValues: {
            emailLogId: log.id,
            recipient,
            cc,
            bcc,
            subject: content.subject,
            invoiceFileId: file.id,
            providerMessageId: sent.providerMessageId,
            status: "SENT",
          },
        },
        auditWriterOf(deps),
      );

      logger.info(
        {
          event: "invoices.emailed",
          actorUserId: actor.userId,
          invoiceId: invoice.id,
          emailLogId: log.id,
          recipient,
        },
        "Invoice email sent",
      );

      await emitOperationalNotification({
        kind: "INVOICE_EMAIL_SENT",
        companyId: invoice.companyId,
        invoiceId: invoice.id,
        invoiceNumber: snapshot.invoiceNumber ?? invoice.invoiceNumber,
        recipient,
      });

      return { ok: true, data: log };
    } catch (error) {
      const message = error instanceof Error ? error.message : INVOICE_EMAIL_SEND_FAILED;
      const failedLog = await deps.emailLogs.create({
        companyId: invoice.companyId,
        invoiceId: invoice.id,
        invoiceFileId: file.id,
        recipient,
        subject: content.subject,
        status: "FAILED",
        providerMessageId: null,
        errorMessage: message,
        retryable: true,
        sentByUserId: actor.userId,
      });

      await recordAuditEventRequired(
        {
          actorType: "USER",
          actorUserId: actor.userId,
          companyId: invoice.companyId,
          entityType: AuditEntityTypes.INVOICE,
          entityId: invoice.id,
          action: AuditActions.INVOICE_EMAIL_FAILED,
          reason: message,
          newValues: {
            emailLogId: failedLog.id,
            recipient,
            cc,
            bcc,
            subject: content.subject,
            invoiceFileId: file.id,
            status: "FAILED",
            retryable: true,
          },
        },
        auditWriterOf(deps),
      );

      logger.error(
        {
          event: "invoices.email_failed",
          actorUserId: actor.userId,
          invoiceId: invoice.id,
          emailLogId: failedLog.id,
          err: message,
        },
        "Invoice email failed",
      );

      await emitOperationalNotification({
        kind: "INVOICE_EMAIL_FAILED",
        companyId: invoice.companyId,
        invoiceId: invoice.id,
        invoiceNumber: snapshot.invoiceNumber ?? invoice.invoiceNumber,
        recipient,
        errorMessage: message,
      });

      // Invoice remains issued; return failure without claiming success.
      return { ok: false, status: 503, error: INVOICE_EMAIL_SEND_FAILED };
    }
  } catch (error) {
    return toEmailError(error);
  }
}

/**
 * Prefill data for the TASK-042 email modal. Does not send.
 */
export async function prepareInvoiceEmailCompose(
  actor: AuthorizationPrincipal | null,
  invoiceId: string,
  deps: InvoiceEmailDependencies = createDefaultInvoiceEmailDependencies(),
): Promise<InvoiceEmailResult<InvoiceEmailComposeDefaults>> {
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
      return { ok: false, status: 403, error: INVOICE_EMAIL_FORBIDDEN };
    }

    const customer = await deps.customers.getCustomerById(invoice.customerId);
    if (!customer) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }

    const canCcBcc = authorizePermission(actor, INVOICE_EMAIL_CC_BCC_PERMISSION).allowed;
    const recipient = customer.email?.trim() || null;
    const recipientValid = isValidCustomerEmail(recipient);

    if (invoice.status === "DRAFT") {
      return {
        ok: true,
        data: {
          invoiceId: invoice.id,
          invoiceStatus: invoice.status,
          recipient,
          recipientValid,
          subject: "",
          body: "",
          canCcBcc,
          invoiceFileId: null,
          hasStoredPdf: false,
          canSend: false,
          blockReason: INVOICE_EMAIL_NOT_ISSUABLE,
        },
      };
    }

    const versions = await deps.versions.listByInvoiceId(invoice.id);
    const files = await deps.files.listByInvoiceId(invoice.id);
    const file = files[0] ?? null;
    const hasStoredPdf = file != null;

    if (versions.length === 0) {
      return {
        ok: true,
        data: {
          invoiceId: invoice.id,
          invoiceStatus: invoice.status,
          recipient,
          recipientValid,
          subject: "",
          body: "",
          canCcBcc,
          invoiceFileId: null,
          hasStoredPdf: false,
          canSend: false,
          blockReason: INVOICE_EMAIL_NOT_ISSUABLE,
        },
      };
    }

    const [company, branding] = await Promise.all([
      deps.companies.getCompanyById(invoice.companyId),
      deps.branding.getBrandingByCompanyId(invoice.companyId),
    ]);
    if (!company) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }

    const version =
      (file ? versions.find((row) => row.id === file.invoiceVersionId) : null) ?? versions[0]!;
    const snapshot = version.snapshot;
    const content = buildInvoiceEmailContent({
      templateReference: branding?.emailTemplateReference ?? null,
      fields: {
        company_name: branding?.displayName ?? company.displayName,
        customer_name: customer.displayName,
        invoice_number: snapshot.invoiceNumber ?? invoice.invoiceNumber ?? invoice.id.slice(0, 8),
        invoice_date: snapshot.invoiceDate,
        due_date: snapshot.dueDate,
        invoice_currency: snapshot.currencyCode,
        invoice_total: snapshot.invoiceTotal,
        amount_paid: snapshot.confirmedPaidAmount,
        balance_due: snapshot.outstandingAmount,
        payment_link: "Payment link: (not available yet)",
        company_email: branding?.email ?? company.email ?? "",
        company_phone: branding?.phone ?? company.phone ?? "",
      },
    });

    let blockReason: string | null = null;
    if (!recipientValid) {
      blockReason = INVOICE_EMAIL_CUSTOMER_REQUIRED;
    }

    return {
      ok: true,
      data: {
        invoiceId: invoice.id,
        invoiceStatus: invoice.status,
        recipient,
        recipientValid,
        subject: content.subject,
        body: content.text,
        canCcBcc,
        invoiceFileId: file?.id ?? null,
        hasStoredPdf,
        canSend: recipientValid,
        blockReason,
      },
    };
  } catch (error) {
    return toEmailError(error);
  }
}

/**
 * Queueable entry (inline by default).
 */
export async function enqueueInvoiceEmail(
  actor: AuthorizationPrincipal | null,
  job: {
    readonly invoiceId: string;
    readonly invoiceFileId?: string | null;
    readonly recipientOverride?: string | null;
    readonly paymentLink?: string | null;
  },
  deps: InvoiceEmailDependencies = createDefaultInvoiceEmailDependencies(),
): Promise<InvoiceEmailResult<EmailLogRecord>> {
  const dispatcher = dispatcherOf(deps);
  if (!dispatcher) {
    return sendInvoiceEmail(actor, job.invoiceId, job, deps);
  }

  try {
    const dispatched = await dispatcher.dispatch({
      invoiceId: job.invoiceId,
      invoiceFileId: job.invoiceFileId,
      recipientOverride: job.recipientOverride,
      paymentLink: job.paymentLink,
      actorUserId: actor?.userId ?? null,
    });
    if (dispatched.emailLogId) {
      const logs = await deps.emailLogs.listByInvoiceId(job.invoiceId);
      const log = logs.find((row) => row.id === dispatched.emailLogId);
      if (log) {
        return { ok: true, data: log };
      }
    }
    if (isQueueEnabled()) {
      return { ok: false, status: 503, error: INVOICE_EMAIL_UNAVAILABLE };
    }
    return sendInvoiceEmail(actor, job.invoiceId, job, deps);
  } catch (error) {
    logger.error(
      {
        event: "invoices.email_enqueue_failed",
        invoiceId: job.invoiceId,
        err: error instanceof Error ? error.message : "unknown",
      },
      "Invoice email enqueue failed",
    );
    return { ok: false, status: 503, error: INVOICE_EMAIL_SEND_FAILED };
  }
}

export async function listInvoiceEmailLogs(
  actor: AuthorizationPrincipal | null,
  invoiceId: string,
  deps: InvoiceEmailDependencies = createDefaultInvoiceEmailDependencies(),
): Promise<InvoiceEmailResult<readonly EmailLogRecord[]>> {
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
      return { ok: false, status: 403, error: INVOICE_EMAIL_FORBIDDEN };
    }
    const logs = await deps.emailLogs.listByInvoiceId(invoice.id);
    return { ok: true, data: logs };
  } catch (error) {
    return toEmailError(error);
  }
}

function toEmailError(error: unknown): {
  ok: false;
  status: 400 | 403 | 404 | 503;
  error: string;
} {
  if (error instanceof AuthorizationError) {
    return { ok: false, status: 403, error: INVOICE_EMAIL_FORBIDDEN };
  }
  logger.error(
    {
      event: "invoices.email_unavailable",
      err: error instanceof Error ? error.message : "unknown",
    },
    "Invoice email operation failed",
  );
  return { ok: false, status: 503, error: INVOICE_EMAIL_UNAVAILABLE };
}
