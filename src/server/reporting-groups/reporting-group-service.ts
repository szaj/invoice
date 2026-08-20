import "server-only";

import { Prisma } from "@/generated/prisma/client";

import { logger } from "@/lib/logger";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import {
  reportingGroupIdSchema,
  reportingGroupStatusUpdateSchema,
  reportingGroupWriteSchema,
} from "@/domain/reporting-groups/schema";
import {
  REPORTING_GROUP_CODE_CONFLICT,
  REPORTING_GROUP_INVALID_INPUT,
  REPORTING_GROUP_NOT_FOUND,
  REPORTING_GROUP_UNAVAILABLE,
  type ReportingGroupRecord,
  type ReportingGroupStatus,
} from "@/domain/reporting-groups/types";
import { PrismaReportingGroupStore } from "@/server/reporting-groups/reporting-group-repository";

export type ReportingGroupResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 403 | 404 | 409 | 503; error: string };

export interface ReportingGroupDependencies {
  readonly store: Pick<
    PrismaReportingGroupStore,
    | "listGroups"
    | "getGroupById"
    | "findByCode"
    | "createGroup"
    | "updateGroup"
    | "setStatus"
    | "countExistingCompanies"
  >;
}

export function createDefaultReportingGroupDependencies(): ReportingGroupDependencies {
  return {
    store: new PrismaReportingGroupStore(),
  };
}

function requireCompanyWrite(actor: AuthorizationPrincipal | null) {
  assertPermission(actor, "company.write");
}

export async function listReportingGroups(
  actor: AuthorizationPrincipal | null,
  deps: ReportingGroupDependencies = createDefaultReportingGroupDependencies(),
): Promise<ReportingGroupResult<ReportingGroupRecord[]>> {
  try {
    requireCompanyWrite(actor);
    const groups = await deps.store.listGroups();
    return { ok: true, data: groups };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

export async function getReportingGroup(
  actor: AuthorizationPrincipal | null,
  groupId: string,
  deps: ReportingGroupDependencies = createDefaultReportingGroupDependencies(),
): Promise<ReportingGroupResult<ReportingGroupRecord>> {
  try {
    requireCompanyWrite(actor);
    const parsedId = reportingGroupIdSchema.safeParse(groupId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: REPORTING_GROUP_NOT_FOUND };
    }

    const group = await deps.store.getGroupById(parsedId.data);
    if (!group) {
      return { ok: false, status: 404, error: REPORTING_GROUP_NOT_FOUND };
    }
    return { ok: true, data: group };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

export async function createReportingGroup(
  actor: AuthorizationPrincipal | null,
  input: unknown,
  deps: ReportingGroupDependencies = createDefaultReportingGroupDependencies(),
): Promise<ReportingGroupResult<ReportingGroupRecord>> {
  try {
    requireCompanyWrite(actor);
    const parsed = reportingGroupWriteSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, status: 400, error: REPORTING_GROUP_INVALID_INPUT };
    }

    const companyCheck = await validateCompanyIds(parsed.data.companyIds, deps);
    if (!companyCheck.ok) {
      return companyCheck;
    }

    const created = await deps.store.createGroup(parsed.data);
    logger.info(
      {
        event: "reporting_groups.created",
        actorUserId: actor?.userId,
        groupId: created.id,
        code: created.code,
        memberCount: created.companyIds.length,
      },
      "Reporting group created",
    );
    return { ok: true, data: created };
  } catch (error) {
    if (isUniqueCodeConflict(error)) {
      return { ok: false, status: 409, error: REPORTING_GROUP_CODE_CONFLICT };
    }
    return toAuthzOrUnavailable(error);
  }
}

export async function updateReportingGroup(
  actor: AuthorizationPrincipal | null,
  groupId: string,
  input: unknown,
  deps: ReportingGroupDependencies = createDefaultReportingGroupDependencies(),
): Promise<ReportingGroupResult<ReportingGroupRecord>> {
  try {
    requireCompanyWrite(actor);
    const parsedId = reportingGroupIdSchema.safeParse(groupId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: REPORTING_GROUP_NOT_FOUND };
    }

    const parsed = reportingGroupWriteSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, status: 400, error: REPORTING_GROUP_INVALID_INPUT };
    }

    const existing = await deps.store.getGroupById(parsedId.data);
    if (!existing) {
      return { ok: false, status: 404, error: REPORTING_GROUP_NOT_FOUND };
    }

    const companyCheck = await validateCompanyIds(parsed.data.companyIds, deps);
    if (!companyCheck.ok) {
      return companyCheck;
    }

    const updated = await deps.store.updateGroup(parsedId.data, parsed.data);
    logger.info(
      {
        event: "reporting_groups.updated",
        actorUserId: actor?.userId,
        groupId: updated.id,
        code: updated.code,
        memberCount: updated.companyIds.length,
      },
      "Reporting group updated",
    );
    return { ok: true, data: updated };
  } catch (error) {
    if (isUniqueCodeConflict(error)) {
      return { ok: false, status: 409, error: REPORTING_GROUP_CODE_CONFLICT };
    }
    return toAuthzOrUnavailable(error);
  }
}

export async function setReportingGroupStatus(
  actor: AuthorizationPrincipal | null,
  groupId: string,
  input: unknown,
  deps: ReportingGroupDependencies = createDefaultReportingGroupDependencies(),
): Promise<ReportingGroupResult<ReportingGroupRecord>> {
  try {
    requireCompanyWrite(actor);
    const parsedId = reportingGroupIdSchema.safeParse(groupId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: REPORTING_GROUP_NOT_FOUND };
    }

    const parsed = reportingGroupStatusUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, status: 400, error: REPORTING_GROUP_INVALID_INPUT };
    }

    const existing = await deps.store.getGroupById(parsedId.data);
    if (!existing) {
      return { ok: false, status: 404, error: REPORTING_GROUP_NOT_FOUND };
    }

    const updated = await deps.store.setStatus(
      parsedId.data,
      parsed.data.status as ReportingGroupStatus,
    );
    logger.info(
      {
        event: "reporting_groups.status_changed",
        actorUserId: actor?.userId,
        groupId: updated.id,
        status: updated.status,
      },
      "Reporting group status changed",
    );
    return { ok: true, data: updated };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

async function validateCompanyIds(
  companyIds: readonly string[],
  deps: ReportingGroupDependencies,
): Promise<ReportingGroupResult<true>> {
  const uniqueIds = [...new Set(companyIds)];
  if (uniqueIds.length !== companyIds.length) {
    return { ok: false, status: 400, error: REPORTING_GROUP_INVALID_INPUT };
  }
  const count = await deps.store.countExistingCompanies(uniqueIds);
  if (count !== uniqueIds.length) {
    return { ok: false, status: 400, error: REPORTING_GROUP_INVALID_INPUT };
  }
  return { ok: true, data: true };
}

function isUniqueCodeConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes("code")
  );
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
    {
      event: "reporting_groups.unavailable",
      err: error instanceof Error ? error.message : "unknown",
    },
    "Reporting group management failed",
  );
  return { ok: false, status: 503, error: REPORTING_GROUP_UNAVAILABLE };
}
