import "server-only";

import { logger } from "@/lib/logger";
import {
  assertPermission,
  canHardDeleteCustomer,
  type AuthorizationPrincipal,
} from "@/domain/authz/authorize";
import {
  assertCompanyAccess,
  assignedCompanyIdsOf,
  companyScopeForRole,
} from "@/domain/authz/company-access";
import { AuthorizationError } from "@/domain/authz/errors";
import { AuditActions, AuditEntityTypes } from "@/domain/audit/types";
import {
  canAccessCustomer,
  CustomerDomainError,
  mergeCustomerCompanyLinks,
} from "@/domain/customers/access";
import {
  canAcknowledgeCustomerDuplicates,
  customerAllowsNewInvoice,
  CUSTOMER_DUPLICATE_ACK_FORBIDDEN,
  CUSTOMER_DUPLICATE_WARNING,
  CUSTOMER_INACTIVE_BLOCKS_NEW_INVOICE,
  matchCustomerDuplicates,
  type CustomerDuplicateMatch,
} from "@/domain/customers/duplicates";
import type { ListPage } from "@/domain/lists/pagination";
import { listPageOf, resolveListPagination } from "@/domain/lists/pagination";
import {
  customerCompaniesUpdateSchema,
  customerCompanyLinkSchema,
  customerIdSchema,
  customerSearchSchema,
  customerStatusUpdateSchema,
  customerWriteSchema,
  resolveCustomerListQuery,
  toCustomerPersistedWriteInput,
  type CustomerWriteInput,
} from "@/domain/customers/schema";
import {
  CUSTOMER_COMPANY_REQUIRED,
  CUSTOMER_DEFAULT_COMPANY_NOT_LINKED,
  CUSTOMER_DUPLICATE_CODE,
  CUSTOMER_INVALID_INPUT,
  CUSTOMER_NOT_FOUND,
  CUSTOMER_STATUS_FORBIDDEN,
  CUSTOMER_UNAVAILABLE,
  type CustomerRecord,
  type CustomerStatus,
} from "@/domain/customers/types";
import {
  getAuditWriter,
  recordAuditEventRequired,
  type AuditWriter,
} from "@/server/audit/audit-service";
import {
  PrismaCustomerStore,
  type CustomerListScope,
} from "@/server/customers/customer-repository";

export type CustomerManagementResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      status: 400 | 403 | 404 | 409 | 503;
      error: string;
      code?: typeof CUSTOMER_DUPLICATE_CODE;
      duplicates?: readonly CustomerDuplicateMatch[];
    };

export interface CustomerManagementDependencies {
  readonly store: Pick<
    PrismaCustomerStore,
    | "listCustomersPage"
    | "getCustomerById"
    | "createCustomer"
    | "updateCustomer"
    | "setCustomerCompanies"
    | "setStatus"
    | "findPotentialDuplicates"
  >;
  readonly auditWriter?: AuditWriter;
}

export function createDefaultCustomerManagementDependencies(): CustomerManagementDependencies {
  return {
    store: new PrismaCustomerStore(),
  };
}

function auditWriterOf(deps: CustomerManagementDependencies): AuditWriter {
  return deps.auditWriter ?? getAuditWriter();
}

function customerAuditSnapshot(customer: CustomerRecord) {
  return {
    displayName: customer.displayName,
    contactPerson: customer.contactPerson,
    customerType: customer.customerType,
    email: customer.email,
    phone: customer.phone,
    alternatePhone: customer.alternatePhone,
    countryCode: customer.countryCode,
    taxRegistrationId: customer.taxRegistrationId,
    defaultInvoiceCurrencyCode: customer.defaultInvoiceCurrencyCode,
    defaultCompanyId: customer.defaultCompanyId,
    paymentPreference: customer.paymentPreference,
    status: customer.status,
    assignedStaffUserId: customer.assignedStaffUserId,
    tags: [...customer.tags],
    companyIds: [...customer.companyIds],
  };
}

function listScopeFor(actor: AuthorizationPrincipal): CustomerListScope {
  const scope = companyScopeForRole(actor.roleCode);
  if (scope === "ALL") {
    return { kind: "all" };
  }
  return {
    kind: "assigned",
    companyIds: assignedCompanyIdsOf(actor),
  };
}

function assertCustomerAccess(
  actor: AuthorizationPrincipal | null,
  customer: CustomerRecord,
): void {
  if (!canAccessCustomer(actor, customer)) {
    throw new AuthorizationError("denied");
  }
}

/**
 * Staff "Limited / assigned": may only assign themselves as staff.
 * Compliance/Admin may assign any staff user id (existence checked later by FK).
 */
function normalizeAssignedStaff(
  actor: AuthorizationPrincipal,
  assignedStaffUserId: string | null,
): string | null {
  if (actor.roleCode === "STAFF") {
    if (assignedStaffUserId && assignedStaffUserId !== actor.userId) {
      throw new AuthorizationError("denied");
    }
    return assignedStaffUserId ?? actor.userId;
  }
  return assignedStaffUserId;
}

function assertLinkableCompanies(
  actor: AuthorizationPrincipal,
  companyIds: readonly string[],
): void {
  for (const companyId of companyIds) {
    assertCompanyAccess(actor, companyId);
  }
}

function resolveCompanyLinksForWrite(input: {
  readonly actor: AuthorizationPrincipal;
  readonly existingCompanyIds: readonly string[];
  readonly requestedCompanyIds: readonly string[];
  readonly requireAtLeastOneForAssigned: boolean;
}): string[] {
  assertLinkableCompanies(input.actor, input.requestedCompanyIds);

  const merged = mergeCustomerCompanyLinks({
    actor: input.actor,
    existingCompanyIds: input.existingCompanyIds,
    requestedCompanyIds: input.requestedCompanyIds,
  });

  const scope = companyScopeForRole(input.actor.roleCode);
  if (scope === "ASSIGNED" && input.requireAtLeastOneForAssigned) {
    const assigned = new Set(assignedCompanyIdsOf(input.actor));
    const owned = merged.filter((id) => assigned.has(id));
    if (owned.length === 0) {
      throw new CustomerDomainError(CUSTOMER_COMPANY_REQUIRED);
    }
  }

  return merged;
}

function assertDefaultCompanyLinked(
  defaultCompanyId: string | null,
  companyIds: readonly string[],
): void {
  if (defaultCompanyId && !companyIds.includes(defaultCompanyId)) {
    throw new CustomerDomainError(CUSTOMER_DEFAULT_COMPANY_NOT_LINKED);
  }
}

async function resolveDuplicateWarning(
  actor: AuthorizationPrincipal,
  input: CustomerWriteInput,
  excludeCustomerId: string | null,
  deps: CustomerManagementDependencies,
): Promise<CustomerManagementResult<never> | null> {
  const candidates = await deps.store.findPotentialDuplicates({
    displayName: input.displayName,
    email: input.email,
    phone: input.phone,
    excludeCustomerId,
  });
  const duplicates = matchCustomerDuplicates(
    {
      displayName: input.displayName,
      email: input.email,
      phone: input.phone,
      excludeCustomerId,
    },
    candidates,
  );
  if (duplicates.length === 0) {
    return null;
  }
  if (!input.acknowledgeDuplicates) {
    return {
      ok: false,
      status: 409,
      error: CUSTOMER_DUPLICATE_WARNING,
      code: CUSTOMER_DUPLICATE_CODE,
      duplicates,
    };
  }
  if (!canAcknowledgeCustomerDuplicates(actor.roleCode)) {
    return {
      ok: false,
      status: 403,
      error: CUSTOMER_DUPLICATE_ACK_FORBIDDEN,
      code: CUSTOMER_DUPLICATE_CODE,
      duplicates,
    };
  }
  return null;
}

function assertSearchCompanyFilter(
  actor: AuthorizationPrincipal,
  companyId: string | undefined,
): void {
  if (!companyId) {
    return;
  }
  assertCompanyAccess(actor, companyId);
}

export async function listCustomers(
  actor: AuthorizationPrincipal | null,
  query: unknown = {},
  deps: CustomerManagementDependencies = createDefaultCustomerManagementDependencies(),
): Promise<CustomerManagementResult<ListPage<CustomerRecord>>> {
  try {
    assertPermission(actor, "customer.edit");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }
    const parsed = customerSearchSchema.safeParse(query ?? {});
    if (!parsed.success) {
      return { ok: false, status: 400, error: CUSTOMER_INVALID_INPUT };
    }
    assertSearchCompanyFilter(actor, parsed.data.companyId);
    const resolved = resolveCustomerListQuery(parsed.data);
    const pagination = resolveListPagination({
      page: resolved.page,
      pageSize: resolved.pageSize,
    });
    const page = await deps.store.listCustomersPage(listScopeFor(actor), {
      ...parsed.data,
      page: pagination.page,
      pageSize: pagination.pageSize,
      sortBy: resolved.sortBy,
      sortDir: resolved.sortDir,
    });
    return { ok: true, data: listPageOf(page.rows, page.totalCount, pagination) };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

export async function getCustomer(
  actor: AuthorizationPrincipal | null,
  customerId: string,
  deps: CustomerManagementDependencies = createDefaultCustomerManagementDependencies(),
): Promise<CustomerManagementResult<CustomerRecord>> {
  try {
    assertPermission(actor, "customer.edit");
    const parsedId = customerIdSchema.safeParse(customerId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: CUSTOMER_NOT_FOUND };
    }
    const customer = await deps.store.getCustomerById(parsedId.data);
    if (!customer) {
      return { ok: false, status: 404, error: CUSTOMER_NOT_FOUND };
    }
    assertCustomerAccess(actor, customer);
    return { ok: true, data: customer };
  } catch (error) {
    if (error && typeof error === "object" && "reason" in error) {
      logger.info(
        {
          event: "authz.customer_access_denied",
          customerId,
          reason: (error as { reason: string }).reason,
          userId: actor?.userId,
        },
        "Customer access denied",
      );
    }
    return toAuthzOrUnavailable(error);
  }
}

export async function createCustomer(
  actor: AuthorizationPrincipal | null,
  input: unknown,
  deps: CustomerManagementDependencies = createDefaultCustomerManagementDependencies(),
): Promise<CustomerManagementResult<CustomerRecord>> {
  try {
    assertPermission(actor, "customer.create");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsed = customerWriteSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, status: 400, error: CUSTOMER_INVALID_INPUT };
    }

    const assignedStaffUserId = normalizeAssignedStaff(actor, parsed.data.assignedStaffUserId);
    const companyIds = resolveCompanyLinksForWrite({
      actor,
      existingCompanyIds: [],
      requestedCompanyIds: parsed.data.companyIds,
      requireAtLeastOneForAssigned: true,
    });
    assertDefaultCompanyLinked(parsed.data.defaultCompanyId, companyIds);

    const writeInput: CustomerWriteInput = {
      ...parsed.data,
      assignedStaffUserId,
      status: "ACTIVE",
      companyIds,
    };

    const duplicateBlock = await resolveDuplicateWarning(actor, writeInput, null, deps);
    if (duplicateBlock) {
      return duplicateBlock;
    }

    const persisted = toCustomerPersistedWriteInput(writeInput);
    const created = await deps.store.createCustomer(persisted, companyIds, {
      createdByUserId: actor.userId,
    });

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor.userId,
        companyId: created.defaultCompanyId ?? created.companyIds[0] ?? null,
        entityType: AuditEntityTypes.CUSTOMER,
        entityId: created.id,
        action: AuditActions.CUSTOMER_CREATED,
        newValues: customerAuditSnapshot(created),
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "customers.created",
        actorUserId: actor.userId,
        customerId: created.id,
        companyIds: created.companyIds,
      },
      "Customer created",
    );

    return { ok: true, data: created };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

export async function updateCustomer(
  actor: AuthorizationPrincipal | null,
  customerId: string,
  input: unknown,
  deps: CustomerManagementDependencies = createDefaultCustomerManagementDependencies(),
): Promise<CustomerManagementResult<CustomerRecord>> {
  try {
    assertPermission(actor, "customer.edit");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsedId = customerIdSchema.safeParse(customerId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: CUSTOMER_NOT_FOUND };
    }

    const existing = await deps.store.getCustomerById(parsedId.data);
    if (!existing) {
      return { ok: false, status: 404, error: CUSTOMER_NOT_FOUND };
    }
    assertCustomerAccess(actor, existing);

    const parsed = customerWriteSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, status: 400, error: CUSTOMER_INVALID_INPUT };
    }

    if (parsed.data.status === "INACTIVE" && existing.status !== "INACTIVE") {
      return { ok: false, status: 400, error: CUSTOMER_STATUS_FORBIDDEN };
    }

    const assignedStaffUserId = normalizeAssignedStaff(actor, parsed.data.assignedStaffUserId);
    const companyIds = resolveCompanyLinksForWrite({
      actor,
      existingCompanyIds: existing.companyIds,
      requestedCompanyIds: parsed.data.companyIds,
      requireAtLeastOneForAssigned: true,
    });
    assertDefaultCompanyLinked(parsed.data.defaultCompanyId, companyIds);

    const writeInput: CustomerWriteInput = {
      ...parsed.data,
      assignedStaffUserId,
      status: existing.status,
      companyIds,
    };

    const duplicateBlock = await resolveDuplicateWarning(actor, writeInput, existing.id, deps);
    if (duplicateBlock) {
      return duplicateBlock;
    }

    const persisted = toCustomerPersistedWriteInput(writeInput);
    const updated = await deps.store.updateCustomer(parsedId.data, persisted, companyIds, {
      updatedByUserId: actor.userId,
    });

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor.userId,
        companyId: updated.defaultCompanyId ?? updated.companyIds[0] ?? null,
        entityType: AuditEntityTypes.CUSTOMER,
        entityId: updated.id,
        action: AuditActions.CUSTOMER_UPDATED,
        oldValues: customerAuditSnapshot(existing),
        newValues: customerAuditSnapshot(updated),
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "customers.updated",
        actorUserId: actor.userId,
        customerId: updated.id,
        companyIds: updated.companyIds,
      },
      "Customer updated",
    );

    return { ok: true, data: updated };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

/**
 * Replace company links (TASK-025). Staff/Compliance may only change companies they can access;
 * links outside their assignment are preserved.
 */
export async function setCustomerCompanies(
  actor: AuthorizationPrincipal | null,
  customerId: string,
  input: unknown,
  deps: CustomerManagementDependencies = createDefaultCustomerManagementDependencies(),
): Promise<CustomerManagementResult<CustomerRecord>> {
  try {
    assertPermission(actor, "customer.edit");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsedId = customerIdSchema.safeParse(customerId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: CUSTOMER_NOT_FOUND };
    }

    const parsed = customerCompaniesUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, status: 400, error: CUSTOMER_INVALID_INPUT };
    }

    const existing = await deps.store.getCustomerById(parsedId.data);
    if (!existing) {
      return { ok: false, status: 404, error: CUSTOMER_NOT_FOUND };
    }
    assertCustomerAccess(actor, existing);

    const companyIds = resolveCompanyLinksForWrite({
      actor,
      existingCompanyIds: existing.companyIds,
      requestedCompanyIds: parsed.data.companyIds,
      requireAtLeastOneForAssigned: true,
    });
    assertDefaultCompanyLinked(existing.defaultCompanyId, companyIds);

    const updated = await deps.store.setCustomerCompanies(parsedId.data, companyIds, {
      updatedByUserId: actor.userId,
    });

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor.userId,
        companyId: updated.defaultCompanyId ?? updated.companyIds[0] ?? null,
        entityType: AuditEntityTypes.CUSTOMER,
        entityId: updated.id,
        action: AuditActions.CUSTOMER_COMPANIES_UPDATED,
        oldValues: { companyIds: [...existing.companyIds] },
        newValues: { companyIds: [...updated.companyIds] },
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "customers.companies_updated",
        actorUserId: actor.userId,
        customerId: updated.id,
        companyIds: updated.companyIds,
      },
      "Customer companies updated",
    );

    return { ok: true, data: updated };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

export async function linkCustomerCompany(
  actor: AuthorizationPrincipal | null,
  customerId: string,
  input: unknown,
  deps: CustomerManagementDependencies = createDefaultCustomerManagementDependencies(),
): Promise<CustomerManagementResult<CustomerRecord>> {
  try {
    assertPermission(actor, "customer.edit");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsedId = customerIdSchema.safeParse(customerId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: CUSTOMER_NOT_FOUND };
    }

    const parsed = customerCompanyLinkSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, status: 400, error: CUSTOMER_INVALID_INPUT };
    }

    const existing = await deps.store.getCustomerById(parsedId.data);
    if (!existing) {
      return { ok: false, status: 404, error: CUSTOMER_NOT_FOUND };
    }
    assertCustomerAccess(actor, existing);

    const requested = [...new Set([...existing.companyIds, parsed.data.companyId])];
    return setCustomerCompanies(actor, customerId, { companyIds: requested }, deps);
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

export async function unlinkCustomerCompany(
  actor: AuthorizationPrincipal | null,
  customerId: string,
  companyId: string,
  deps: CustomerManagementDependencies = createDefaultCustomerManagementDependencies(),
): Promise<CustomerManagementResult<CustomerRecord>> {
  try {
    assertPermission(actor, "customer.edit");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsedId = customerIdSchema.safeParse(customerId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: CUSTOMER_NOT_FOUND };
    }

    const parsedCompany = customerCompanyLinkSchema.safeParse({ companyId });
    if (!parsedCompany.success) {
      return { ok: false, status: 400, error: CUSTOMER_INVALID_INPUT };
    }

    const existing = await deps.store.getCustomerById(parsedId.data);
    if (!existing) {
      return { ok: false, status: 404, error: CUSTOMER_NOT_FOUND };
    }
    assertCustomerAccess(actor, existing);

    assertCompanyAccess(actor, parsedCompany.data.companyId);

    const requested = existing.companyIds.filter((id) => id !== parsedCompany.data.companyId);
    return setCustomerCompanies(actor, customerId, { companyIds: requested }, deps);
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

/**
 * Soft-delete / deactivation (BR-012). Hard delete is never allowed.
 * Deactivated customers preserve history; new invoices are blocked by
 * {@link assertCustomerActiveForNewInvoice} when invoicing exists.
 */
export async function setCustomerStatus(
  actor: AuthorizationPrincipal | null,
  customerId: string,
  input: unknown,
  deps: CustomerManagementDependencies = createDefaultCustomerManagementDependencies(),
): Promise<CustomerManagementResult<CustomerRecord>> {
  try {
    assertPermission(actor, "customer.delete");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }
    if (canHardDeleteCustomer()) {
      return { ok: false, status: 400, error: CUSTOMER_INVALID_INPUT };
    }

    const parsedId = customerIdSchema.safeParse(customerId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: CUSTOMER_NOT_FOUND };
    }

    const parsed = customerStatusUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, status: 400, error: CUSTOMER_INVALID_INPUT };
    }

    const existing = await deps.store.getCustomerById(parsedId.data);
    if (!existing) {
      return { ok: false, status: 404, error: CUSTOMER_NOT_FOUND };
    }
    assertCustomerAccess(actor, existing);

    const updated = await deps.store.setStatus(
      parsedId.data,
      parsed.data.status as CustomerStatus,
      {
        updatedByUserId: actor.userId,
      },
    );

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor.userId,
        companyId: updated.defaultCompanyId ?? updated.companyIds[0] ?? null,
        entityType: AuditEntityTypes.CUSTOMER,
        entityId: updated.id,
        action: AuditActions.CUSTOMER_STATUS_CHANGED,
        oldValues: { status: existing.status },
        newValues: { status: updated.status },
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "customers.status_changed",
        actorUserId: actor.userId,
        customerId: updated.id,
        status: updated.status,
      },
      "Customer status changed",
    );

    return { ok: true, data: updated };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

/**
 * Hook for invoicing modules: inactive customers cannot receive new invoices.
 * History remains readable. Does not implement invoices (TASK-028 gate only).
 */
export function assertCustomerActiveForNewInvoice(customer: Pick<CustomerRecord, "status">): void {
  if (!customerAllowsNewInvoice(customer.status)) {
    throw new CustomerDomainError(CUSTOMER_INACTIVE_BLOCKS_NEW_INVOICE);
  }
}

function toAuthzOrUnavailable(error: unknown): {
  ok: false;
  status: 400 | 403 | 503;
  error: string;
} {
  if (error instanceof CustomerDomainError) {
    return { ok: false, status: 400, error: error.message };
  }

  if (error instanceof AuthorizationError) {
    return {
      ok: false,
      status: 403,
      error: error.message,
    };
  }

  if (error && typeof error === "object" && "status" in error && "message" in error) {
    const status = error.status;
    if (status === 401 || status === 403) {
      return {
        ok: false,
        status: 403,
        error:
          typeof error.message === "string"
            ? error.message
            : "You do not have permission to perform this action.",
      };
    }
  }

  logger.error(
    { event: "customers.unavailable", err: error instanceof Error ? error.message : "unknown" },
    "Customer management failed",
  );
  return { ok: false, status: 503, error: CUSTOMER_UNAVAILABLE };
}
