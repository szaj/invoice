import "server-only";

import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import { AuthorizationError } from "@/domain/authz/errors";
import { canAccessCustomer, authorizedCustomerCompanyIds } from "@/domain/customers/access";
import {
  buildCustomerFinancialSummary,
  type CustomerFinancialSummaryAggregate,
} from "@/domain/customers/financial-summary";
import {
  toProfileFinancialSummary,
  type CustomerProfileFinancialSummary,
} from "@/domain/customers/profile";
import { customerIdSchema, customerProfileQuerySchema } from "@/domain/customers/schema";
import {
  CUSTOMER_INVALID_INPUT,
  CUSTOMER_NOT_FOUND,
  CUSTOMER_UNAVAILABLE,
} from "@/domain/customers/types";
import { logger } from "@/lib/logger";
import { PrismaCustomerStore } from "@/server/customers/customer-repository";
import type { CustomerFinancialSummarySource } from "@/server/customers/customer-financial-summary-source";
import { PrismaCustomerFinancialSummarySource } from "@/server/customers/prisma-customer-financial-summary-source";

export type CustomerFinancialSummaryResult =
  | {
      ok: true;
      data: {
        customerId: string;
        companyFilterId: string | null;
        authorizedCompanyIds: readonly string[];
        financialSummary: CustomerProfileFinancialSummary;
        aggregate: CustomerFinancialSummaryAggregate;
      };
    }
  | { ok: false; status: 400 | 403 | 404 | 503; error: string };

export interface CustomerFinancialSummaryDependencies {
  readonly customerStore: Pick<PrismaCustomerStore, "getCustomerById">;
  readonly financialSource: CustomerFinancialSummarySource;
}

export function createDefaultCustomerFinancialSummaryDependencies(): CustomerFinancialSummaryDependencies {
  return {
    customerStore: new PrismaCustomerStore(),
    financialSource: new PrismaCustomerFinancialSummarySource(),
  };
}

/**
 * Currency-aware financial summary for a customer (TASK-029).
 * Reuses profile company scoping. Does not invent totals or convert without snapshots.
 */
export async function getCustomerFinancialSummary(
  actor: AuthorizationPrincipal | null,
  customerId: string,
  query: unknown = {},
  deps: CustomerFinancialSummaryDependencies = createDefaultCustomerFinancialSummaryDependencies(),
): Promise<CustomerFinancialSummaryResult> {
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

    const sourceRows = await deps.financialSource.listInvoiceRowsForCustomer({
      customerId: customer.id,
      authorizedCompanyIds,
    });

    const aggregate = buildCustomerFinancialSummary(sourceRows, {
      companyFilterId,
    });
    const financialSummary = toProfileFinancialSummary(
      aggregate.byCurrency,
      deps.financialSource.available,
    );

    return {
      ok: true,
      data: {
        customerId: customer.id,
        companyFilterId,
        authorizedCompanyIds,
        financialSummary,
        aggregate,
      },
    };
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
        event: "customers.financial_summary_unavailable",
        err: error instanceof Error ? error.message : "unknown",
      },
      "Customer financial summary failed",
    );
    return { ok: false, status: 503, error: CUSTOMER_UNAVAILABLE };
  }
}
