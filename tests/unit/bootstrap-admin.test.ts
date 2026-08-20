import { describe, expect, it } from "vitest";

import {
  bootstrapAdmin,
  parseBootstrapAdminEmailArg,
  type BootstrapAdminStore,
  type BootstrapAdminUserRecord,
} from "@/domain/ops/bootstrap-admin";

function user(overrides: Partial<BootstrapAdminUserRecord> = {}): BootstrapAdminUserRecord {
  return {
    id: "user-1",
    email: "admin@example.com",
    status: "ACTIVE",
    supabaseAuthUserId: "11111111-1111-1111-1111-111111111111",
    roleCode: null,
    hasUnresolvedRole: false,
    ...overrides,
  };
}

function createStore(options?: {
  user?: BootstrapAdminUserRecord | null;
  adminRoleId?: string | null;
}): BootstrapAdminStore & { assignCalls: number } {
  const state = {
    assignCalls: 0,
    user: options && "user" in options ? options.user : user(),
    adminRoleId: options?.adminRoleId === undefined ? "role-admin" : options.adminRoleId,
  };

  return {
    get assignCalls() {
      return state.assignCalls;
    },
    async findUserByEmail(email) {
      if (!state.user || state.user.email !== email) {
        return null;
      }
      return state.user;
    },
    async findAdminRoleId() {
      return state.adminRoleId;
    },
    async assignAdminRole() {
      state.assignCalls += 1;
    },
  };
}

describe("parseBootstrapAdminEmailArg", () => {
  it("parses --email and --email= forms", () => {
    expect(parseBootstrapAdminEmailArg(["--email", "Ada@Example.com"])).toBe("Ada@Example.com");
    expect(parseBootstrapAdminEmailArg(["--email=ops@example.com"])).toBe("ops@example.com");
    expect(parseBootstrapAdminEmailArg(["-e", "ops@example.com"])).toBe("ops@example.com");
    expect(parseBootstrapAdminEmailArg([])).toBeNull();
  });
});

describe("bootstrapAdmin", () => {
  it("assigns ADMIN when the linked ACTIVE user has no role", async () => {
    const store = createStore();
    const result = await bootstrapAdmin("Admin@Example.com", store);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.outcome).toBe("assigned");
      expect(result.email).toBe("admin@example.com");
      expect(result.userManageResolved).toBe(true);
    }
    expect(store.assignCalls).toBe(1);
  });

  it("is idempotent when the user is already ADMIN", async () => {
    const store = createStore({ user: user({ roleCode: "ADMIN" }) });
    const result = await bootstrapAdmin("admin@example.com", store);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.outcome).toBe("already_admin");
    }
    expect(store.assignCalls).toBe(0);
  });

  it("fails when the user is missing", async () => {
    const store = createStore({ user: null });
    const result = await bootstrapAdmin("missing@example.com", store);
    expect(result).toMatchObject({ ok: false, code: "user_not_found" });
    expect(store.assignCalls).toBe(0);
  });

  it("fails when the user is not linked to Supabase Auth", async () => {
    const store = createStore({ user: user({ supabaseAuthUserId: null }) });
    const result = await bootstrapAdmin("admin@example.com", store);
    expect(result).toMatchObject({ ok: false, code: "not_linked" });
    expect(store.assignCalls).toBe(0);
  });

  it("fails when the user is suspended", async () => {
    const store = createStore({ user: user({ status: "SUSPENDED" }) });
    const result = await bootstrapAdmin("admin@example.com", store);
    expect(result).toMatchObject({ ok: false, code: "not_active" });
    expect(store.assignCalls).toBe(0);
  });

  it("fails when the ADMIN role is missing", async () => {
    const store = createStore({ adminRoleId: null });
    const result = await bootstrapAdmin("admin@example.com", store);
    expect(result).toMatchObject({ ok: false, code: "admin_role_missing" });
    expect(store.assignCalls).toBe(0);
  });

  it("refuses to replace an existing non-Admin role", async () => {
    const store = createStore({ user: user({ roleCode: "STAFF" }) });
    const result = await bootstrapAdmin("admin@example.com", store);
    expect(result).toMatchObject({ ok: false, code: "role_conflict" });
    expect(store.assignCalls).toBe(0);
  });

  it("refuses unresolved role assignments", async () => {
    const store = createStore({ user: user({ hasUnresolvedRole: true }) });
    const result = await bootstrapAdmin("admin@example.com", store);
    expect(result).toMatchObject({ ok: false, code: "role_conflict" });
    expect(store.assignCalls).toBe(0);
  });

  it("rejects invalid email input", async () => {
    const store = createStore();
    const result = await bootstrapAdmin("not-an-email", store);
    expect(result).toMatchObject({ ok: false, code: "invalid_email" });
    expect(store.assignCalls).toBe(0);
  });
});
