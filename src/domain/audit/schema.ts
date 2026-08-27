import { z } from "zod";

import {
  AUDIT_ACTOR_TYPES,
  AUDIT_INVALID_INPUT,
  AUDIT_VIEWER_MAX_LIMIT,
} from "@/domain/audit/types";

const auditActorTypeSchema = z.enum(AUDIT_ACTOR_TYPES);

export const appendAuditEventSchema = z.object({
  actorType: auditActorTypeSchema,
  actorUserId: z.string().trim().min(1).max(100).nullable().optional(),
  companyId: z.string().trim().min(1).max(100).nullable().optional(),
  entityType: z.string().trim().min(1).max(100),
  entityId: z.string().trim().min(1).max(200).nullable().optional(),
  action: z.string().trim().min(1).max(120),
  oldValues: z.unknown().optional(),
  newValues: z.unknown().optional(),
  reason: z.string().trim().min(1).max(2000).nullable().optional(),
  ipAddress: z.string().trim().min(1).max(200).nullable().optional(),
  userAgent: z.string().trim().min(1).max(1000).nullable().optional(),
  correlationId: z.string().trim().min(1).max(200).nullable().optional(),
  occurredAt: z.date().optional(),
});

export type AppendAuditEventInput = z.infer<typeof appendAuditEventSchema>;

function blankToNull(value: unknown): unknown {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function emptyToUndefined(value: unknown): unknown {
  const next = blankToNull(value);
  return next === null ? undefined : next;
}

const optionalUuid = z.preprocess(emptyToUndefined, z.uuid().optional());

const optionalActorType = z.preprocess(emptyToUndefined, auditActorTypeSchema.optional());

const optionalEntityType = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).max(100).optional(),
);

const optionalEntityId = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).max(200).optional(),
);

const optionalAction = z.preprocess(emptyToUndefined, z.string().trim().min(1).max(120).optional());

function optionalViewerDate(endOfDay: boolean) {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
      const trimmed = value.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return new Date(`${trimmed}T${endOfDay ? "23:59:59.999Z" : "00:00:00.000Z"}`);
      }
      const parsed = new Date(trimmed);
      return Number.isNaN(parsed.getTime()) ? trimmed : parsed;
    }
    return value;
  }, z.date().optional());
}

const optionalLimit = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isNaN(parsed) ? value : parsed;
  }
  return value;
}, z.number().int().min(1).max(AUDIT_VIEWER_MAX_LIMIT).optional());

/**
 * Read-only audit viewer filters (TASK-076).
 * company / actor / actor type / entity / action / date range.
 */
export const auditViewerQuerySchema = z
  .strictObject({
    companyId: optionalUuid,
    actorUserId: optionalUuid,
    actorType: optionalActorType,
    entityType: optionalEntityType,
    entityId: optionalEntityId,
    action: optionalAction,
    dateFrom: optionalViewerDate(false),
    dateTo: optionalViewerDate(true),
    limit: optionalLimit,
  })
  .superRefine((value, ctx) => {
    if (value.dateFrom && value.dateTo && value.dateFrom.getTime() > value.dateTo.getTime()) {
      ctx.addIssue({
        code: "custom",
        message: AUDIT_INVALID_INPUT,
        path: ["dateFrom"],
      });
    }
  });

export type AuditViewerQuery = z.output<typeof auditViewerQuerySchema>;

function firstSearchParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return undefined;
}

/**
 * Parse audit viewer page searchParams into query input (TASK-076).
 * Keeps filter/query logic out of React components.
 */
export function parseAuditViewerSearchParams(
  params: Record<string, string | string[] | undefined>,
): AuditViewerQuery {
  const parsed = auditViewerQuerySchema.safeParse({
    companyId: firstSearchParam(params.companyId),
    actorUserId: firstSearchParam(params.actorUserId),
    actorType: firstSearchParam(params.actorType),
    entityType: firstSearchParam(params.entityType),
    entityId: firstSearchParam(params.entityId),
    action: firstSearchParam(params.action),
    dateFrom: firstSearchParam(params.dateFrom),
    dateTo: firstSearchParam(params.dateTo),
    limit: firstSearchParam(params.limit),
  });
  return parsed.success ? parsed.data : {};
}
