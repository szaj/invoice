export type AuditActorType = "USER" | "SYSTEM" | "WEBHOOK";

export type AuditJson =
  null | boolean | number | string | readonly AuditJson[] | { readonly [key: string]: AuditJson };

/**
 * Append-only audit event input after domain validation / masking.
 * Application APIs must not update or delete stored events.
 */
export interface AuditEventInput {
  readonly actorType: AuditActorType;
  readonly actorUserId?: string | null;
  readonly companyId?: string | null;
  readonly entityType: string;
  readonly entityId?: string | null;
  readonly action: string;
  readonly oldValues?: AuditJson;
  readonly newValues?: AuditJson;
  readonly reason?: string | null;
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
  readonly correlationId?: string | null;
  readonly occurredAt?: Date;
}

export interface AuditEventRecord extends AuditEventInput {
  readonly id: string;
  readonly occurredAt: Date;
  readonly actorUserId: string | null;
  readonly companyId: string | null;
  readonly entityId: string | null;
  readonly oldValues: AuditJson;
  readonly newValues: AuditJson;
  readonly reason: string | null;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly correlationId: string | null;
}

export const AUDIT_APPEND_ONLY_MESSAGE = "Audit events are append-only.";
export const AUDIT_WRITE_UNAVAILABLE = "Audit logging is temporarily unavailable.";

/** Mandatory TASK-012 security/admin actions that already exist in the product. */
export const AuditActions = {
  LOGIN_SUCCEEDED: "auth.login_succeeded",
  LOGIN_FAILED: "auth.login_failed",
  LOGOUT_SUCCEEDED: "auth.logout_succeeded",
  USER_CREATED: "users.created",
  USER_UPDATED: "users.updated",
  USER_SUSPENDED: "users.suspended",
  COMPANY_CREATED: "companies.created",
  COMPANY_UPDATED: "companies.updated",
  COMPANY_STATUS_CHANGED: "companies.status_changed",
  SETTINGS_UPDATED: "settings.updated",
  CURRENCY_CREATED: "currencies.created",
  CURRENCY_UPDATED: "currencies.updated",
  CURRENCY_STATUS_CHANGED: "currencies.status_changed",
  COMPANY_CURRENCIES_UPDATED: "companies.currencies_updated",
  FIXED_RATE_CREATED: "fixed_rates.created",
  FIXED_RATE_SCHEDULED: "fixed_rates.scheduled",
  FIXED_RATE_ACTIVATED: "fixed_rates.activated",
  FIXED_RATE_EXPIRED: "fixed_rates.expired",
  FIXED_RATE_SUPERSEDED: "fixed_rates.superseded",
  SETTLEMENT_CURRENCIES_UPDATED: "settlement.currencies_updated",
  CUSTOMER_CREATED: "customers.created",
  CUSTOMER_UPDATED: "customers.updated",
  CUSTOMER_STATUS_CHANGED: "customers.status_changed",
  CUSTOMER_COMPANIES_UPDATED: "customers.companies_updated",
  CUSTOMER_NOTE_CREATED: "customers.note_created",
  INVOICE_CREATED: "invoices.created",
  INVOICE_UPDATED: "invoices.updated",
  INVOICE_LINE_ITEMS_UPDATED: "invoices.line_items_updated",
  INVOICE_NUMBER_ASSIGNED: "invoices.number_assigned",
  INVOICE_ISSUED: "invoices.issued",
  INVOICE_OVERDUE_MARKED: "invoices.overdue_marked",
  INVOICE_VERSION_CREATED: "invoices.version_created",
  INVOICE_METADATA_UPDATED: "invoices.metadata_updated",
  INVOICE_CANCELLED: "invoices.cancelled",
  INVOICE_PDF_GENERATED: "invoices.pdf_generated",
  INVOICE_EMAILED: "invoices.emailed",
  INVOICE_EMAIL_FAILED: "invoices.email_failed",
  INVOICE_DUPLICATED: "invoices.duplicated",
} as const;

export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions];

export const AuditEntityTypes = {
  SESSION: "session",
  USER: "user",
  COMPANY: "company",
  SETTINGS: "settings",
  CURRENCY: "currency",
  FIXED_CONVERSION_RATE: "fixed_conversion_rate",
  PAYMENT_GATEWAY_CONFIG: "payment_gateway_config",
  CUSTOMER: "customer",
  INVOICE: "invoice",
  PAYMENT: "payment",
} as const;
