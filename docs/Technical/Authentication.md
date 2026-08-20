---
type: technical
status: approved
tags:
  - technical
  - security
---

# Authentication

Supabase Auth identity foundation for TASK-003. Authorization remains application-owned and is **not** implemented here. See [[05 Architecture Decisions#ADR-003 — Authentication|ADR-003]] and [[Security]].

## Boundary

```text
Supabase Auth
    ↓
Who is this identity?

Application Database / Domain
    ↓
What is this user allowed to do? For which company?
```

`authenticated` is not `authorized`. Later tasks add application users (beyond identity mapping), roles, permissions, company assignment, and tenant isolation.

Do **not** store or read roles, permissions, company IDs, Admin/Compliance/Staff status, or financial permissions from Supabase Auth `user_metadata`, `app_metadata`, JWT claims, or custom claims.

## Clients

| Client | Location | Keys |
| --- | --- | --- |
| Browser | `src/lib/supabase/browser-client.ts` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Server | `src/lib/supabase/server-client.ts` | Same public values plus httpOnly cookies |
| Proxy | `src/lib/supabase/proxy-client.ts` | Session refresh via `getUser()` |

`SUPABASE_SERVICE_ROLE_KEY` is server-only and is not used by TASK-003 login/logout. Never prefix it with `NEXT_PUBLIC_`.

## Session checks

Identity is established server-side with `supabase.auth.getUser()`:

- Next.js `proxy.ts` refreshes cookies and redirects unauthenticated visitors away from application routes
- Server Components / layouts call `getAuthenticatedIdentity()`
- Server Actions and Route Handlers authenticate independently

The protected boundary only requires a valid authenticated session. It does not check role, company, or application-user status.

## Routes

| Path | Purpose |
| --- | --- |
| `GET /login` | Login UI |
| `POST` Server Action `loginAction` | Login |
| `POST /api/auth/login` | Login JSON API |
| `POST` Server Action `logoutAction` | Logout |
| `POST /api/auth/logout` | Logout JSON API |
| `GET /` | Authenticated identity shell and logout |

There is no public `/signup`. Account provisioning is a later Admin/user-management task.

Password reset and extra session controls belong to [[TASK-004 Password Reset and Session Controls]].

## Identity mapping

Table `users` stores: `id`, `name`, `email`, `supabase_auth_user_id`, `status`, `last_login_at`, timestamps.

Successful login upserts this row by Supabase Auth user ID and updates `last_login_at`. Credentials live in Supabase Auth. There is no application `password_hash`. There are no role, permission, or company columns.

## Rate limiting

Login is rate-limited at the application `LoginRateLimiter` boundary.

The current implementation is `MemoryLoginRateLimiter`:

- process-local / in-memory only
- effective only inside a single Node.js process
- **not** globally effective across multiple application containers
- **not** the final production distributed rate-limiting mechanism

Production distributed limiting is expected to use the approved Redis infrastructure (ADR-005). Replacing the in-memory class with a Redis-backed `LoginRateLimiter` must not require changing login use cases.

Password-reset rate limiting belongs to [[TASK-004 Password Reset and Session Controls]].

## HTTPS

Non-local `APP_ENV` values require HTTPS: secure cookies and HTTP→HTTPS redirect at the proxy. `local` allows `http://localhost`.

## Related

- [[Security]]
- [[Roles and Permissions]]
- [[API and Integrations]]
- [[TASK-003 Authentication Base]]
