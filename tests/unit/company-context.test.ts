import { describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import {
  assertResolvedCompanyContext,
  assertTransactionalCompanyScope,
  CompanyContextError,
  requireConcreteCompanyId,
} from "@/domain/company-context/enforce";
import {
  parseCompanyContextCookieValue,
  resolveCompanyContext,
  serializeCompanyContextSelection,
} from "@/domain/company-context/resolve";
import {
  ALL_COMPANIES_CONTEXT_VALUE,
  CONCRETE_COMPANY_REQUIRED_MESSAGE,
  INVALID_COMPANY_CONTEXT_MESSAGE,
} from "@/domain/company-context/types";
import type { RoleCode } from "@/domain/authz/roles";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";

function principal(
  roleCode: RoleCode | null,
  assignedCompanyIds: readonly string[] = [],
): AuthorizationPrincipal {
  return {
    userId: "actor-1",
    status: "ACTIVE",
    roleCode,
    assignedCompanyIds,
  };
}

describe("company context resolver", () => {
  it("defaults Admin to All Companies when cookie is empty", () => {
    const resolved = resolveCompanyContext({
      principal: principal("ADMIN"),
      rawSelection: null,
      accessibleCompanyIds: [COMPANY_A, COMPANY_B],
    });
    expect(resolved).toEqual({
      status: "resolved",
      selection: { kind: "all" },
    });
  });

  it("lets Admin select a concrete company or All Companies", () => {
    const all = resolveCompanyContext({
      principal: principal("ADMIN"),
      rawSelection: ALL_COMPANIES_CONTEXT_VALUE,
      accessibleCompanyIds: [COMPANY_A],
    });
    expect(all).toEqual({ status: "resolved", selection: { kind: "all" } });

    const one = resolveCompanyContext({
      principal: principal("ADMIN"),
      rawSelection: COMPANY_A,
      accessibleCompanyIds: [COMPANY_A, COMPANY_B],
    });
    expect(one).toEqual({
      status: "resolved",
      selection: { kind: "company", companyId: COMPANY_A },
    });
  });

  it("defaults Staff to the first assigned company and rejects All Companies", () => {
    const staff = principal("STAFF", [COMPANY_A, COMPANY_B]);
    const fallback = resolveCompanyContext({
      principal: staff,
      rawSelection: null,
      accessibleCompanyIds: [COMPANY_A, COMPANY_B],
    });
    expect(fallback).toEqual({
      status: "resolved",
      selection: { kind: "company", companyId: COMPANY_A },
    });

    const deniedAll = resolveCompanyContext({
      principal: staff,
      rawSelection: ALL_COMPANIES_CONTEXT_VALUE,
      accessibleCompanyIds: [COMPANY_A, COMPANY_B],
    });
    expect(deniedAll).toEqual({ status: "unresolved", reason: "invalid_selection" });
  });

  it("rejects Staff selection of an unassigned company", () => {
    const resolved = resolveCompanyContext({
      principal: principal("STAFF", [COMPANY_A]),
      rawSelection: COMPANY_B,
      accessibleCompanyIds: [COMPANY_A],
    });
    expect(resolved).toEqual({ status: "unresolved", reason: "invalid_selection" });
  });

  it("does not grant access via reporting-group shaped fields", () => {
    const staff = {
      ...principal("STAFF", [COMPANY_A]),
      reportingGroupId: "vx",
    } as AuthorizationPrincipal & { reportingGroupId: string };

    const resolved = resolveCompanyContext({
      principal: staff,
      rawSelection: COMPANY_B,
      accessibleCompanyIds: [COMPANY_A, COMPANY_B],
    });
    expect(resolved.status).toBe("unresolved");
  });

  it("serializes and parses cookie values", () => {
    expect(serializeCompanyContextSelection({ kind: "all" })).toBe(ALL_COMPANIES_CONTEXT_VALUE);
    expect(serializeCompanyContextSelection({ kind: "company", companyId: COMPANY_A })).toBe(
      COMPANY_A,
    );
    expect(parseCompanyContextCookieValue(ALL_COMPANIES_CONTEXT_VALUE)).toEqual({ kind: "all" });
    expect(parseCompanyContextCookieValue(COMPANY_A)).toEqual({
      kind: "company",
      companyId: COMPANY_A,
    });
    expect(parseCompanyContextCookieValue("not-a-uuid")).toBeNull();
  });

  it("returns unresolved when Staff has no assigned companies", () => {
    const resolved = resolveCompanyContext({
      principal: principal("STAFF", []),
      rawSelection: null,
      accessibleCompanyIds: [],
    });
    expect(resolved).toEqual({ status: "unresolved", reason: "no_accessible_companies" });
  });
});

describe("company context transactional enforcement", () => {
  it("rejects transactional actions in All Companies context", () => {
    const resolved = resolveCompanyContext({
      principal: principal("ADMIN"),
      rawSelection: ALL_COMPANIES_CONTEXT_VALUE,
      accessibleCompanyIds: [COMPANY_A],
    });
    expect(() => requireConcreteCompanyId(resolved)).toThrow(CONCRETE_COMPANY_REQUIRED_MESSAGE);
    expect(() => assertTransactionalCompanyScope(principal("ADMIN"), resolved, COMPANY_A)).toThrow(
      CompanyContextError,
    );
  });

  it("denies cross-company IDOR when context does not match requested company", () => {
    const resolved = resolveCompanyContext({
      principal: principal("ADMIN"),
      rawSelection: COMPANY_A,
      accessibleCompanyIds: [COMPANY_A, COMPANY_B],
    });
    expect(() => assertTransactionalCompanyScope(principal("ADMIN"), resolved, COMPANY_B)).toThrow(
      INVALID_COMPANY_CONTEXT_MESSAGE,
    );
  });

  it("allows matching concrete company when principal has access", () => {
    const adminResolved = resolveCompanyContext({
      principal: principal("ADMIN"),
      rawSelection: COMPANY_A,
      accessibleCompanyIds: [COMPANY_A, COMPANY_B],
    });
    expect(assertTransactionalCompanyScope(principal("ADMIN"), adminResolved, COMPANY_A)).toBe(
      "ADMIN",
    );

    const staff = principal("STAFF", [COMPANY_A]);
    const staffResolved = resolveCompanyContext({
      principal: staff,
      rawSelection: COMPANY_A,
      accessibleCompanyIds: [COMPANY_A],
    });
    expect(assertTransactionalCompanyScope(staff, staffResolved, COMPANY_A)).toBe("STAFF");
  });

  it("denies Staff transactional access to an unassigned company even if context were forged", () => {
    const staff = principal("STAFF", [COMPANY_A]);
    const forged = {
      status: "resolved" as const,
      selection: { kind: "company" as const, companyId: COMPANY_B },
    };
    expect(() => assertTransactionalCompanyScope(staff, forged, COMPANY_B)).toThrow(
      GENERIC_FORBIDDEN,
    );
  });

  it("rejects unresolved context", () => {
    expect(() =>
      assertResolvedCompanyContext({ status: "unresolved", reason: "invalid_selection" }),
    ).toThrow(INVALID_COMPANY_CONTEXT_MESSAGE);
  });
});
