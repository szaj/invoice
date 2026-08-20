import "server-only";

import { logger } from "@/lib/logger";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import { AuditActions, AuditEntityTypes } from "@/domain/audit/types";
import {
  COMPANY_INVALID_INPUT,
  COMPANY_NOT_FOUND_MESSAGE,
  COMPANY_UNAVAILABLE,
  type CompanyRecord,
  type CompanyStatus,
} from "@/domain/companies/types";
import {
  companyIdSchema,
  companyStatusUpdateSchema,
  companyWriteSchema,
} from "@/domain/companies/company-schema";
import {
  getAuditWriter,
  recordAuditEventRequired,
  type AuditWriter,
} from "@/server/audit/audit-service";
import { PrismaCompanyStore } from "@/server/companies/company-repository";

export type CompanyManagementResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 403 | 404 | 503; error: string };

export interface CompanyManagementDependencies {
  readonly store: Pick<
    PrismaCompanyStore,
    "listCompanies" | "getCompanyById" | "createCompany" | "updateCompany" | "setStatus"
  >;
  readonly auditWriter?: AuditWriter;
}

export function createDefaultCompanyManagementDependencies(): CompanyManagementDependencies {
  return {
    store: new PrismaCompanyStore(),
  };
}

function auditWriterOf(deps: CompanyManagementDependencies): AuditWriter {
  return deps.auditWriter ?? getAuditWriter();
}

function requireCompanyWrite(actor: AuthorizationPrincipal | null) {
  assertPermission(actor, "company.write");
}

function companyAuditSnapshot(company: CompanyRecord) {
  return {
    displayName: company.displayName,
    legalName: company.legalName,
    email: company.email,
    phone: company.phone,
    website: company.website,
    registrationTaxNumber: company.registrationTaxNumber,
    addressLine1: company.addressLine1,
    addressLine2: company.addressLine2,
    city: company.city,
    region: company.region,
    postalCode: company.postalCode,
    countryCode: company.countryCode,
    status: company.status,
  };
}

export async function listCompanies(
  actor: AuthorizationPrincipal | null,
  deps: CompanyManagementDependencies = createDefaultCompanyManagementDependencies(),
): Promise<CompanyManagementResult<CompanyRecord[]>> {
  try {
    requireCompanyWrite(actor);
    const companies = await deps.store.listCompanies();
    return { ok: true, data: companies };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

export async function getCompany(
  actor: AuthorizationPrincipal | null,
  companyId: string,
  deps: CompanyManagementDependencies = createDefaultCompanyManagementDependencies(),
): Promise<CompanyManagementResult<CompanyRecord>> {
  try {
    const parsedId = companyIdSchema.safeParse(companyId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }

    assertCompanyAccess(actor, parsedId.data);

    const company = await deps.store.getCompanyById(parsedId.data);
    if (!company) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }
    return { ok: true, data: company };
  } catch (error) {
    if (error && typeof error === "object" && "reason" in error && "status" in error) {
      logger.info(
        {
          event: "authz.company_access_denied",
          companyId,
          reason: error.reason,
          userId: actor?.userId,
        },
        "Company access denied",
      );
    }
    return toAuthzOrUnavailable(error);
  }
}

export async function createCompany(
  actor: AuthorizationPrincipal | null,
  input: unknown,
  deps: CompanyManagementDependencies = createDefaultCompanyManagementDependencies(),
): Promise<CompanyManagementResult<CompanyRecord>> {
  try {
    requireCompanyWrite(actor);
    const parsed = companyWriteSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, status: 400, error: COMPANY_INVALID_INPUT };
    }

    const created = await deps.store.createCompany(parsed.data);
    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor?.userId ?? null,
        companyId: created.id,
        entityType: AuditEntityTypes.COMPANY,
        entityId: created.id,
        action: AuditActions.COMPANY_CREATED,
        newValues: companyAuditSnapshot(created),
      },
      auditWriterOf(deps),
    );
    logger.info(
      {
        event: "companies.created",
        actorUserId: actor?.userId,
        companyId: created.id,
        status: created.status,
      },
      "Company created",
    );
    return { ok: true, data: created };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

export async function updateCompany(
  actor: AuthorizationPrincipal | null,
  companyId: string,
  input: unknown,
  deps: CompanyManagementDependencies = createDefaultCompanyManagementDependencies(),
): Promise<CompanyManagementResult<CompanyRecord>> {
  try {
    requireCompanyWrite(actor);
    const parsedId = companyIdSchema.safeParse(companyId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }

    const parsed = companyWriteSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, status: 400, error: COMPANY_INVALID_INPUT };
    }

    const existing = await deps.store.getCompanyById(parsedId.data);
    if (!existing) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }

    const updated = await deps.store.updateCompany(parsedId.data, parsed.data);
    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor?.userId ?? null,
        companyId: updated.id,
        entityType: AuditEntityTypes.COMPANY,
        entityId: updated.id,
        action: AuditActions.COMPANY_UPDATED,
        oldValues: companyAuditSnapshot(existing),
        newValues: companyAuditSnapshot(updated),
      },
      auditWriterOf(deps),
    );
    logger.info(
      {
        event: "companies.updated",
        actorUserId: actor?.userId,
        companyId: updated.id,
        status: updated.status,
      },
      "Company updated",
    );
    return { ok: true, data: updated };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

export async function setCompanyStatus(
  actor: AuthorizationPrincipal | null,
  companyId: string,
  input: unknown,
  deps: CompanyManagementDependencies = createDefaultCompanyManagementDependencies(),
): Promise<CompanyManagementResult<CompanyRecord>> {
  try {
    requireCompanyWrite(actor);
    const parsedId = companyIdSchema.safeParse(companyId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }

    const parsed = companyStatusUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, status: 400, error: COMPANY_INVALID_INPUT };
    }

    const existing = await deps.store.getCompanyById(parsedId.data);
    if (!existing) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }

    const updated = await deps.store.setStatus(parsedId.data, parsed.data.status as CompanyStatus);
    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor?.userId ?? null,
        companyId: updated.id,
        entityType: AuditEntityTypes.COMPANY,
        entityId: updated.id,
        action: AuditActions.COMPANY_STATUS_CHANGED,
        oldValues: { status: existing.status },
        newValues: { status: updated.status },
      },
      auditWriterOf(deps),
    );
    logger.info(
      {
        event: "companies.status_changed",
        actorUserId: actor?.userId,
        companyId: updated.id,
        status: updated.status,
      },
      "Company status changed",
    );
    return { ok: true, data: updated };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

function toAuthzOrUnavailable(error: unknown): { ok: false; status: 403 | 503; error: string } {
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
    { event: "companies.unavailable", err: error instanceof Error ? error.message : "unknown" },
    "Company management failed",
  );
  return { ok: false, status: 503, error: COMPANY_UNAVAILABLE };
}
