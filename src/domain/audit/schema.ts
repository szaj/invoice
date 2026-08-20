import { z } from "zod";

const auditActorTypeSchema = z.enum(["USER", "SYSTEM", "WEBHOOK"]);

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
