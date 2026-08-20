import { z } from "zod";

import { roleHasPermission } from "@/domain/authz/matrix";
import type { RoleCode } from "@/domain/authz/roles";
import { isRoleCode } from "@/domain/authz/roles";

export type BootstrapAdminFailureCode =
  | "invalid_email"
  | "user_not_found"
  | "not_linked"
  | "not_active"
  | "admin_role_missing"
  | "role_conflict";

export type BootstrapAdminResult =
  | {
      ok: true;
      outcome: "assigned" | "already_admin";
      email: string;
      userId: string;
      userManageResolved: boolean;
    }
  | {
      ok: false;
      code: BootstrapAdminFailureCode;
      message: string;
    };

export interface BootstrapAdminUserRecord {
  readonly id: string;
  readonly email: string;
  readonly status: "ACTIVE" | "SUSPENDED";
  readonly supabaseAuthUserId: string | null;
  readonly roleCode: RoleCode | null;
  /** True when role_id is set but the role row/code could not be resolved. */
  readonly hasUnresolvedRole: boolean;
}

export interface BootstrapAdminStore {
  findUserByEmail(normalizedEmail: string): Promise<BootstrapAdminUserRecord | null>;
  findAdminRoleId(): Promise<string | null>;
  assignAdminRole(userId: string, adminRoleId: string): Promise<void>;
}

const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(320));

export function normalizeBootstrapEmail(email: string): string | null {
  const parsed = emailSchema.safeParse(email);
  return parsed.success ? parsed.data : null;
}

/**
 * One-time operational bootstrap: assign the system ADMIN role in the application DB.
 * Does not touch Supabase Auth, passwords, or Auth metadata.
 * Does not bypass runtime authorization for HTTP/Server Actions.
 */
export async function bootstrapAdmin(
  emailInput: string,
  store: BootstrapAdminStore,
): Promise<BootstrapAdminResult> {
  const email = normalizeBootstrapEmail(emailInput);
  if (!email) {
    return {
      ok: false,
      code: "invalid_email",
      message: "Provide a valid email address with --email.",
    };
  }

  const user = await store.findUserByEmail(email);
  if (!user) {
    return {
      ok: false,
      code: "user_not_found",
      message:
        "No application user exists for that email. Sign in once first to create the identity mapping.",
    };
  }

  if (!user.supabaseAuthUserId) {
    return {
      ok: false,
      code: "not_linked",
      message: "Application user is not linked to a Supabase Auth identity.",
    };
  }

  if (user.status !== "ACTIVE") {
    return {
      ok: false,
      code: "not_active",
      message: "Application user must be ACTIVE before Admin bootstrap.",
    };
  }

  if (user.hasUnresolvedRole) {
    return {
      ok: false,
      code: "role_conflict",
      message: "User has an unresolved role assignment. Refusing to overwrite it.",
    };
  }

  if (user.roleCode === "ADMIN") {
    return {
      ok: true,
      outcome: "already_admin",
      email: user.email,
      userId: user.id,
      userManageResolved: roleHasPermission("ADMIN", "user.manage"),
    };
  }

  if (user.roleCode !== null) {
    return {
      ok: false,
      code: "role_conflict",
      message: `User already has role ${user.roleCode}. Refusing to replace a non-Admin role.`,
    };
  }

  const adminRoleId = await store.findAdminRoleId();
  if (!adminRoleId) {
    return {
      ok: false,
      code: "admin_role_missing",
      message: "System ADMIN role was not found. Apply the roles/permissions migration first.",
    };
  }

  await store.assignAdminRole(user.id, adminRoleId);

  return {
    ok: true,
    outcome: "assigned",
    email: user.email,
    userId: user.id,
    userManageResolved: roleHasPermission("ADMIN", "user.manage"),
  };
}

export function parseBootstrapAdminEmailArg(argv: readonly string[]): string | null {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) {
      continue;
    }
    if (arg === "--email" || arg === "-e") {
      return argv[index + 1] ?? null;
    }
    if (arg.startsWith("--email=")) {
      return arg.slice("--email=".length) || null;
    }
  }
  return null;
}

export function isKnownRoleCode(value: string | null | undefined): value is RoleCode {
  return isRoleCode(value);
}
