---
type: technical
status: approved
tags:
  - technical
  - security
---

# Authentication

Supabase Auth identity, password recovery, and session controls. Authorization remains application-owned and is **not** implemented here. See [[05 Architecture Decisions#ADR-003 — Authentication|ADR-003]] and [[Security]].

## Boundary

```text
Supabase Auth
    ↓
Who is this identity?

Application Database / Domain
    ↓
What is this user allowed to do? For which company?
```

`authenticated` is not `authorized`. [[TASK-005 Roles and Permissions Model]] adds application roles and permissions. [[TASK-008 User Company Assignments]] stores company assignments in the application database, not in Auth metadata.

Do **not** store or read roles, permissions, company IDs, Admin/Compliance/Staff status, or financial permissions from Supabase Auth `user_metadata`, `app_metadata`, JWT claims, or custom claims.

Supabase Auth owns:

- login / logout
- password credentials
- password recovery email
- password update
- authentication sessions

The application database owns the identity mapping row and the `password_reset_required` **workflow flag**. That flag is not a password, hash, or reset token.

## Clients

| Client | Location | Keys |
| --- | --- | --- |
| Browser | `src/lib/supabase/browser-client.ts` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Server | `src/lib/supabase/server-client.ts` | Same public values plus httpOnly cookies |
| Proxy | `src/lib/supabase/proxy-client.ts` | Session refresh via `getUser()` |

`SUPABASE_SERVICE_ROLE_KEY` is server-only. Never prefix it with `NEXT_PUBLIC_`.

## Session checks

Identity is established server-side with `supabase.auth.getUser()`:

- Next.js `proxy.ts` refreshes cookies and redirects unauthenticated visitors away from application routes
- Server Components / layouts call `getAuthenticatedIdentity()`
- Server Actions and Route Handlers authenticate independently
- Invalid or expired sessions force login
- After a successful password update the current Auth session is signed out globally; the user must sign in with the new password
- If the application user has `password_reset_required`, authenticated application routes redirect to Reset Password

The protected boundary requires a valid authenticated session, plus the password-reset-required workflow flag when set. Role/permission checks are a separate application authorization layer. See [[Authorization]].

## Password recovery

```text
Forgot Password
      ↓
Email submitted
      ↓
Generic response
      ↓
Supabase recovery email
      ↓
User opens secure recovery link
      ↓
GET /auth/callback (PKCE code or recovery OTP)
      ↓
Reset Password screen
      ↓
New password submitted
      ↓
Supabase Auth password updated
      ↓
Session signed out → Login
```

Recovery tokens are exchanged server-side. The application does not invent or store reset tokens. Redirects use `APP_URL` (or `http://localhost:3000` when `APP_ENV=local`). Client-supplied redirect URLs are ignored unless they match the trusted path allowlist.

Forgot-password always returns:

```text
If an account exists for this email, password recovery instructions have been sent.
```

It does not reveal whether the email exists. Provider outages after a valid request also return that generic message so responses cannot be used to enumerate accounts.

Supabase Auth sends the recovery email. This cycle does not call Resend or EmailService.

Configure the Supabase Auth redirect allow list to include `{APP_URL}/auth/callback`.

## Routes

| Path | Purpose |
| --- | --- |
| `GET /login` | Login UI |
| `POST` Server Action `loginAction` | Login |
| `POST /api/auth/login` | Login JSON API |
| `POST` Server Action `logoutAction` | Logout |
| `POST /api/auth/logout` | Logout JSON API |
| `GET /forgot-password` | Forgot password UI |
| `POST` Server Action `forgotPasswordAction` | Request recovery email |
| `POST /api/auth/forgot-password` | Request recovery JSON API |
| `GET /auth/callback` | Supabase recovery callback |
| `GET /reset-password` | Reset password UI |
| `POST` Server Action `resetPasswordAction` | Update password |
| `POST /api/auth/reset-password` | Update password JSON API |
| `GET /` | Authenticated identity shell and logout |

There is no public `/signup`. Account provisioning is Admin user management ([[TASK-006 User Management]]).

## Identity mapping

Table `users` stores: `id`, `name`, `email`, `supabase_auth_user_id`, `status`, `role_id` (optional until assigned by Admin), `employee_id`, `mfa_enabled` (status only), `created_by_user_id`, `last_login_at`, `password_reset_required`, timestamps.

Successful login upserts this row by Supabase Auth user ID and updates `last_login_at`. It does **not** assign a role. Login rejects `SUSPENDED` application users after Auth succeeds and clears the session. Successful password reset clears `password_reset_required`. Credentials live in Supabase Auth. There is no application `password_hash` or `reset_token`. Company assignment columns are not present. `password_reset_required` is workflow/session state only — not a role or permission.

Admin create/edit/suspend/reset uses application `user.manage` authorization and may call Supabase Auth Admin APIs only inside the provisioning adapter (`SUPABASE_SERVICE_ROLE_KEY`). Roles and permissions are never written into Auth metadata.

## Bootstrap Admin (operational)

Initial environments have a chicken-and-egg problem: User Management requires `user.manage`, but the first Admin has no role until one is assigned.

Use the one-time CLI after the operator has already signed in once (so the application `users` identity row exists and is linked to Supabase Auth):

```text
pnpm bootstrap:admin -- --email existing-user@example.com
```

Rules:

- Assigns the system `ADMIN` role in the **application database only**
- Requires an existing ACTIVE application user linked to Supabase Auth
- Does **not** create Auth users, accept passwords, or write Auth metadata
- Is idempotent when the user is already Admin
- Refuses to replace an existing non-Admin role
- Does not bypass runtime HTTP/Server Action authorization

After bootstrap, all later role changes must go through authorized User Management. Production execution of this command (and access to `DATABASE_URL`) must itself be operationally restricted.

## Rate limiting

Login and password recovery share the `AuthRateLimiter` boundary.

The current implementation is `MemoryWindowRateLimiter`:

- process-local / in-memory only
- effective only inside a single Node.js process
- **not** globally effective across multiple application containers
- **not** the final production distributed rate-limiting mechanism

Production distributed limiting is expected to use the approved Redis infrastructure (ADR-005). Replacing the in-memory class with a Redis-backed `AuthRateLimiter` must not require changing login or recovery use cases.

Supabase Auth may also rate-limit recovery emails independently of this application limiter.

## HTTPS

Non-local `APP_ENV` values require HTTPS: secure cookies and HTTP→HTTPS redirect at the proxy. `local` allows `http://localhost`.

`APP_URL` is required outside local development so recovery redirects cannot be derived from untrusted request hosts.

## Related

- [[Authorization]]
- [[Security]]
- [[Roles and Permissions]]
- [[API and Integrations]]
- [[TASK-003 Authentication Base]]
- [[TASK-004 Password Reset and Session Controls]]
- [[TASK-005 Roles and Permissions Model]]
- [[TASK-006 User Management]]
