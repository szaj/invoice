import "server-only";

import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import { AuthorizationError } from "@/domain/authz/errors";
import { AuditEntityTypes } from "@/domain/audit/types";
import { authorizedCustomerCompanyIds, canAccessCustomer } from "@/domain/customers/access";
import { buildCustomerFinancialSummary } from "@/domain/customers/financial-summary";
import {
  PROFILE_INVOICES_PLACEHOLDER,
  PROFILE_PAYMENTS_PLACEHOLDER,
  toProfileFinancialSummary,
  type CustomerProfile,
} from "@/domain/customers/profile";
import { customerIdSchema, customerProfileQuerySchema } from "@/domain/customers/schema";
import {
  CUSTOMER_INVALID_INPUT,
  CUSTOMER_NOT_FOUND,
  CUSTOMER_UNAVAILABLE,
  type CustomerRecord,
} from "@/domain/customers/types";
import { logger } from "@/lib/logger";
import { PrismaAuditEventStore } from "@/server/audit/audit-repository";
import { PrismaCompanyStore } from "@/server/companies/company-repository";
import { PrismaCustomerStore } from "@/server/customers/customer-repository";
import { PrismaCustomerNoteStore } from "@/server/customers/customer-note-repository";
import {
  EmptyCustomerFinancialSummarySource,
  type CustomerFinancialSummarySource,
} from "@/server/customers/customer-financial-summary-source";
import { PrismaCustomerFinancialSummarySource } from "@/server/customers/prisma-customer-financial-summary-source";

export type CustomerProfileResult =
  { ok: true; data: CustomerProfile } | { ok: false; status: 400 | 403 | 404 | 503; error: string };

export interface CustomerProfileDependencies {
  readonly customerStore: Pick<PrismaCustomerStore, "getCustomerById">;
  readonly companyStore: Pick<PrismaCompanyStore, "listCompaniesByIds">;
  readonly auditStore: Pick<PrismaAuditEventStore, "listByEntity">;
  readonly noteStore: Pick<PrismaCustomerNoteStore, "listByCustomerId">;
  readonly financialSource?: CustomerFinancialSummarySource;
}

export function createDefaultCustomerProfileDependencies(): CustomerProfileDependencies {
  return {
    customerStore: new PrismaCustomerStore(),
    companyStore: new PrismaCompanyStore(),
    auditStore: new PrismaAuditEventStore(),
    noteStore: new PrismaCustomerNoteStore(),
    financialSource: new PrismaCustomerFinancialSummarySource(),
  };
}

/**
 * @deprecated Prefer {@link authorizedCustomerCompanyIds} from domain.
 */
export function authorizedProfileCompanyIds(
  actor: AuthorizationPrincipal,
  linkedCompanyIds: readonly string[],
): string[] {
  return authorizedCustomerCompanyIds(actor, linkedCompanyIds);
}

function withAuthorizedCompanyIds(
  customer: CustomerRecord,
  authorizedCompanyIds: readonly string[],
): CustomerRecord {
  return {
    ...customer,
    companyIds: [...authorizedCompanyIds],
  };
}

/**
 * Profile summary for the customer operational view (TASK-026 / TASK-029).
 * Reuses customer access; financial summary is currency-aware and never invents mixed totals (BR-013).
 */
export async function getCustomerProfile(
  actor: AuthorizationPrincipal | null,
  customerId: string,
  query: unknown = {},
  deps: CustomerProfileDependencies = createDefaultCustomerProfileDependencies(),
): Promise<CustomerProfileResult> {
  try {
    assertPermission(actor, "customer.edit");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsedId = customerIdSchema.safeParse(customerId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: CUSTOMER_NOT_FOUND };
    }

    const parsedQuery = customerProfileQuerySchema.safeParse(query ?? {});
    if (!parsedQuery.success) {
      return { ok: false, status: 400, error: CUSTOMER_INVALID_INPUT };
    }

    const customer = await deps.customerStore.getCustomerById(parsedId.data);
    if (!customer) {
      return { ok: false, status: 404, error: CUSTOMER_NOT_FOUND };
    }

    if (!canAccessCustomer(actor, customer)) {
      throw new AuthorizationError("denied");
    }

    const authorizedCompanyIds = authorizedCustomerCompanyIds(actor, customer.companyIds);
    const companyFilterId = parsedQuery.data.companyId ?? null;

    if (companyFilterId) {
      if (!authorizedCompanyIds.includes(companyFilterId)) {
        throw new AuthorizationError("denied");
      }
      assertCompanyAccess(actor, companyFilterId);
    }

    const financialSource = deps.financialSource ?? new EmptyCustomerFinancialSummarySource();

    const [companies, activityRows, notes, sourceRows] = await Promise.all([
      deps.companyStore.listCompaniesByIds(authorizedCompanyIds),
      deps.auditStore.listByEntity({
        entityType: AuditEntityTypes.CUSTOMER,
        entityId: customer.id,
        allowedCompanyIds: authorizedCompanyIds,
        companyId: companyFilterId,
        limit: 50,
      }),
      deps.noteStore.listByCustomerId(customer.id),
      financialSource.listInvoiceRowsForCustomer({
        customerId: customer.id,
        authorizedCompanyIds,
      }),
    ]);
    const companyOptions = companies
      .map((company) => ({ id: company.id, displayName: company.displayName }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    const aggregate = buildCustomerFinancialSummary(sourceRows, { companyFilterId });
    const financialSummary = toProfileFinancialSummary(
      aggregate.byCurrency,
      financialSource.available,
    );

    const profile: CustomerProfile = {
      customer: withAuthorizedCompanyIds(customer, authorizedCompanyIds),
      companies: companyOptions,
      companyFilterId,
      financialSummary,
      invoices: {
        status: "placeholder",
        message: PROFILE_INVOICES_PLACEHOLDER,
        items: [],
      },
      payments: {
        status: "placeholder",
        message: PROFILE_PAYMENTS_PLACEHOLDER,
        items: [],
      },
      notes: {
        status: "ready",
        internalOnly: true,
        items: notes,
      },
      activity: {
        items: activityRows.map((row) => ({
          id: row.id,
          occurredAt: row.occurredAt,
          action: row.action,
          companyId: row.companyId,
          actorUserId: row.actorUserId,
        })),
      },
    };

    return { ok: true, data: profile };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, status: 403, error: error.message };
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
      {
        event: "customers.profile_unavailable",
        err: error instanceof Error ? error.message : "unknown",
      },
      "Customer profile failed",
    );
    return { ok: false, status: 503, error: CUSTOMER_UNAVAILABLE };
  }
}
