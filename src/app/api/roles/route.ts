import { NextResponse } from "next/server";

import { listRoleCatalog } from "@/domain/authz/catalog";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { isSameOriginRequest } from "@/server/auth/request";
import { authorizationFailureResponse, requirePermission } from "@/server/authz/require-permission";

/**
 * Representative protected action for TASK-005.
 * Listing the role catalog requires user.manage (Admin only).
 * This is not user CRUD (TASK-006) and not company assignment (TASK-008).
 */
export async function GET(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status: 403 });
  }

  try {
    await requirePermission("user.manage");
    return NextResponse.json({ ok: true, roles: listRoleCatalog() });
  } catch (error) {
    return authorizationFailureResponse(error);
  }
}
