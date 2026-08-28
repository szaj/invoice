import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  assertPermission,
  authorizePermission,
  type AuthorizationPrincipal,
} from "@/domain/authz/authorize";
import { assertCompanyAccess, authorizeCompanyAccess } from "@/domain/authz/company-access";
import { AuthorizationError, GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { roleHasPermission, ROLE_PERMISSIONS } from "@/domain/authz/matrix";
import { PERMISSION_CODES, type PermissionCode } from "@/domain/authz/permissions";
import { ROLE_CODES } from "@/domain/authz/roles";
import { authorizationFailureResponse } from "@/server/authz/require-permission";
import {
  authenticatedWithoutRole,
  ASSIGNED_COMPANY_ID,
  OTHER_COMPANY_ID,
  principal,
} from "../helpers/authz-fixtures";

function walkFiles(directory: string, predicate: (file: string) => boolean): string[] {
  if (!existsSync(directory)) {
    return [];
  }

  const entries = readdirSync(directory);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...walkFiles(fullPath, predicate));
      continue;
    }
    if (predicate(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

function uncommented(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
}

function expectAuthorizationDenied(
  actor: AuthorizationPrincipal | null,
  permission: PermissionCode,
  status: 401 | 403,
) {
  const decision = authorizePermission(actor, permission);
  expect(decision.allowed).toBe(false);

  try {
    assertPermission(actor, permission);
    throw new Error(`expected ${permission} to be denied`);
  } catch (error) {
    expect(error).toBeInstanceOf(AuthorizationError);
    if (error instanceof AuthorizationError) {
      expect(error.status).toBe(status);
      expect(error.message).toBe(GENERIC_FORBIDDEN);
    }
  }
}

describe("authorization suite (TASK-093)", () => {
  describe("authenticated ≠ authorized (BR-016)", () => {
    it("denies an authenticated principal without an application role", () => {
      const actor = authenticatedWithoutRole();
      expect(actor.userId).toBeTruthy();
      expect(authorizePermission(actor, "dashboard.view").allowed).toBe(false);
      expectAuthorizationDenied(actor, "dashboard.view", 403);
    });

    it("denies unauthenticated callers with 401", () => {
      expectAuthorizationDenied(null, "dashboard.view", 401);
    });

    it("denies suspended principals with 403", () => {
      expectAuthorizationDenied(principal("ADMIN", { status: "SUSPENDED" }), "dashboard.view", 403);
    });
  });

  describe("role permission matrix", () => {
    it("matches the domain matrix for every role and permission", () => {
      for (const role of ROLE_CODES) {
        for (const permission of PERMISSION_CODES) {
          expect(roleHasPermission(role, permission)).toBe(ROLE_PERMISSIONS[role].has(permission));
        }
      }
    });

    it.each([
      ["STAFF", "user.manage"],
      ["STAFF", "payment.manual.record"],
      ["STAFF", "audit.read"],
      ["STAFF", "settings.manage"],
      ["COMPLIANCE", "user.manage"],
      ["COMPLIANCE", "settings.manage"],
      ["COMPLIANCE", "company.write"],
    ] as const)("denies %s for %s with 403", (role, permission) => {
      expectAuthorizationDenied(principal(role), permission, 403);
    });

    it.each([
      ["ADMIN", "user.manage"],
      ["COMPLIANCE", "payment.manual.record"],
      ["STAFF", "invoice.create"],
    ] as const)("allows %s for %s", (role, permission) => {
      expect(authorizePermission(principal(role), permission).allowed).toBe(true);
      expect(assertPermission(principal(role), permission)).toBe(role);
    });
  });

  describe("cross-company access", () => {
    it("lets Admin access any company without assignment rows", () => {
      const admin = principal("ADMIN", { assignedCompanyIds: [] });
      expect(authorizeCompanyAccess(admin, OTHER_COMPANY_ID)).toEqual({ allowed: true });
      expect(assertCompanyAccess(admin, OTHER_COMPANY_ID)).toBe("ADMIN");
    });

    it.each(["STAFF", "COMPLIANCE"] as const)(
      "denies %s access to an unassigned company with 403",
      (role) => {
        const actor = principal(role, { assignedCompanyIds: [ASSIGNED_COMPANY_ID] });
        expect(authorizeCompanyAccess(actor, ASSIGNED_COMPANY_ID)).toEqual({ allowed: true });
        const denied = authorizeCompanyAccess(actor, OTHER_COMPANY_ID);
        expect(denied.allowed).toBe(false);
        if (!denied.allowed) {
          expect(denied.reason).toBe("denied");
        }
        try {
          assertCompanyAccess(actor, OTHER_COMPANY_ID);
          throw new Error("expected company access denial");
        } catch (error) {
          expect(error).toBeInstanceOf(AuthorizationError);
          if (error instanceof AuthorizationError) {
            expect(error.status).toBe(403);
            expect(error.message).toBe(GENERIC_FORBIDDEN);
          }
        }
      },
    );
  });

  describe("403 on permission failure", () => {
    it("returns 403 JSON for denied authorization errors", () => {
      const response = authorizationFailureResponse(new AuthorizationError("denied"));
      expect(response.status).toBe(403);
    });

    it("returns 401 JSON for unauthenticated authorization errors", () => {
      const response = authorizationFailureResponse(new AuthorizationError("unauthenticated"));
      expect(response.status).toBe(401);
    });
  });

  describe("HTTP route handler boundary", () => {
    const apiRoot = path.join(process.cwd(), "src", "app", "api");
    const exemptRoutePrefixes = [
      path.join(apiRoot, "auth"),
      path.join(apiRoot, "health"),
      path.join(apiRoot, "webhooks"),
    ];

    it("requires application authorization on every protected Route Handler", () => {
      const routeFiles = walkFiles(apiRoot, (file) => file.endsWith(`${path.sep}route.ts`));
      const missing: string[] = [];

      for (const file of routeFiles) {
        if (exemptRoutePrefixes.some((prefix) => file.startsWith(prefix))) {
          continue;
        }

        const source = uncommented(readFileSync(file, "utf8"));
        if (
          !source.includes("getRequestAuthorizationPrincipal") &&
          !source.includes("requirePermission")
        ) {
          missing.push(path.relative(process.cwd(), file));
        }
      }

      expect(missing).toEqual([]);
    });
  });

  describe("Server Action boundary", () => {
    const serverRoot = path.join(process.cwd(), "src", "server");
    const exemptActions = new Set([
      path.join(serverRoot, "auth", "actions.ts"),
    ]);

    it("loads the application principal in every protected Server Action module", () => {
      const actionFiles = walkFiles(serverRoot, (file) => file.endsWith("actions.ts"));
      const missing: string[] = [];

      for (const file of actionFiles) {
        const source = readFileSync(file, "utf8");
        if (!source.includes('"use server"')) {
          continue;
        }
        if (exemptActions.has(file)) {
          continue;
        }
        if (!source.includes("getRequestAuthorizationPrincipal")) {
          missing.push(path.relative(process.cwd(), file));
        }
      }

      expect(missing).toEqual([]);
    });
  });
});
