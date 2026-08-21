import "server-only";

import { logger } from "@/lib/logger";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import { AuthorizationError } from "@/domain/authz/errors";
import { AuditActions, AuditEntityTypes } from "@/domain/audit/types";
import { canAccessCustomer } from "@/domain/customers/access";
import { customerNoteCreateSchema } from "@/domain/customers/note-schema";
import {
  CUSTOMER_NOTE_INVALID_INPUT,
  CUSTOMER_NOTE_UNAVAILABLE,
  type CustomerNoteRecord,
} from "@/domain/customers/notes";
import { customerIdSchema } from "@/domain/customers/schema";
import { CUSTOMER_NOT_FOUND } from "@/domain/customers/types";
import {
  getAuditWriter,
  recordAuditEventRequired,
  type AuditWriter,
} from "@/server/audit/audit-service";
import { PrismaCustomerStore } from "@/server/customers/customer-repository";
import { PrismaCustomerNoteStore } from "@/server/customers/customer-note-repository";

export type CustomerNoteResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 403 | 404 | 503; error: string };

export interface CustomerNoteDependencies {
  readonly customerStore: Pick<PrismaCustomerStore, "getCustomerById">;
  readonly noteStore: Pick<PrismaCustomerNoteStore, "listByCustomerId" | "createNote">;
  readonly auditWriter?: AuditWriter;
}

export function createDefaultCustomerNoteDependencies(): CustomerNoteDependencies {
  return {
    customerStore: new PrismaCustomerStore(),
    noteStore: new PrismaCustomerNoteStore(),
  };
}

function auditWriterOf(deps: CustomerNoteDependencies): AuditWriter {
  return deps.auditWriter ?? getAuditWriter();
}

async function loadAccessibleCustomer(
  actor: AuthorizationPrincipal,
  customerId: string,
  deps: CustomerNoteDependencies,
) {
  const parsedId = customerIdSchema.safeParse(customerId);
  if (!parsedId.success) {
    return { ok: false as const, status: 404 as const, error: CUSTOMER_NOT_FOUND };
  }
  const customer = await deps.customerStore.getCustomerById(parsedId.data);
  if (!customer) {
    return { ok: false as const, status: 404 as const, error: CUSTOMER_NOT_FOUND };
  }
  if (!canAccessCustomer(actor, customer)) {
    throw new AuthorizationError("denied");
  }
  return { ok: true as const, customer };
}

/**
 * List internal notes for a customer the actor can access (TASK-027).
 */
export async function listCustomerNotes(
  actor: AuthorizationPrincipal | null,
  customerId: string,
  deps: CustomerNoteDependencies = createDefaultCustomerNoteDependencies(),
): Promise<CustomerNoteResult<CustomerNoteRecord[]>> {
  try {
    assertPermission(actor, "customer.edit");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const access = await loadAccessibleCustomer(actor, customerId, deps);
    if (!access.ok) {
      return access;
    }

    const notes = await deps.noteStore.listByCustomerId(access.customer.id);
    return { ok: true, data: notes };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

/**
 * Create an internal-only note. Author is the authenticated actor.
 */
export async function createCustomerNote(
  actor: AuthorizationPrincipal | null,
  customerId: string,
  input: unknown,
  deps: CustomerNoteDependencies = createDefaultCustomerNoteDependencies(),
): Promise<CustomerNoteResult<CustomerNoteRecord>> {
  try {
    assertPermission(actor, "customer.edit");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const access = await loadAccessibleCustomer(actor, customerId, deps);
    if (!access.ok) {
      return access;
    }

    const parsed = customerNoteCreateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, status: 400, error: CUSTOMER_NOTE_INVALID_INPUT };
    }

    const created = await deps.noteStore.createNote({
      customerId: access.customer.id,
      authorUserId: actor.userId,
      body: parsed.data.body,
    });

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor.userId,
        companyId: access.customer.defaultCompanyId ?? access.customer.companyIds[0] ?? null,
        entityType: AuditEntityTypes.CUSTOMER,
        entityId: access.customer.id,
        action: AuditActions.CUSTOMER_NOTE_CREATED,
        newValues: {
          noteId: created.id,
          visibility: created.visibility,
          bodyLength: created.body.length,
        },
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "customers.note_created",
        actorUserId: actor.userId,
        customerId: access.customer.id,
        noteId: created.id,
      },
      "Customer note created",
    );

    return { ok: true, data: created };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

function toAuthzOrUnavailable(error: unknown): {
  ok: false;
  status: 400 | 403 | 503;
  error: string;
} {
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
      event: "customers.notes_unavailable",
      err: error instanceof Error ? error.message : "unknown",
    },
    "Customer notes failed",
  );
  return { ok: false, status: 503, error: CUSTOMER_NOTE_UNAVAILABLE };
}
