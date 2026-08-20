import "server-only";

import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import {
  GENERIC_FORBIDDEN,
  AuthorizationError,
  isAuthorizationError,
  type AuthorizationDenialReason,
} from "@/domain/authz/errors";
import { HIGH_RISK_PERMISSIONS, type PermissionCode } from "@/domain/authz/permissions";
import { getAuthenticatedIdentity } from "@/server/auth/session";
import { loadAuthorizationPrincipal } from "@/server/authz/principal";

export async function getRequestAuthorizationPrincipal(): Promise<AuthorizationPrincipal | null> {
  const identity = await getAuthenticatedIdentity();
  if (!identity) {
    return null;
  }

  const principal = await loadAuthorizationPrincipal(identity.authUserId);
  if (principal) {
    return principal;
  }

  return {
    userId: identity.authUserId,
    status: "ACTIVE",
    roleCode: null,
    assignedCompanyIds: [],
  };
}

export async function requirePermission(
  permission: PermissionCode,
): Promise<AuthorizationPrincipal> {
  const principal = await getRequestAuthorizationPrincipal();

  try {
    assertPermission(principal, permission);
  } catch (error) {
    if (isAuthorizationError(error) && HIGH_RISK_PERMISSIONS.has(permission)) {
      logger.info(
        {
          event: "authz.denied",
          permission,
          reason: error.reason,
          userId: principal?.userId,
        },
        "Permission denied",
      );
    }
    throw error;
  }

  if (!principal) {
    throw new AuthorizationError("unauthenticated");
  }

  return principal;
}

export function authorizationErrorResponse(reason: AuthorizationDenialReason) {
  const status = reason === "unauthenticated" ? 401 : 403;
  return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status });
}

export function authorizationFailureResponse(error: unknown) {
  if (isAuthorizationError(error)) {
    return authorizationErrorResponse(error.reason);
  }

  throw error;
}
