---
type: module
status: approved
phase: 9
domain: ops
tags:
  - module
---

# Deployment

> [!abstract] Related
> [[05 Architecture Decisions#ADR-017 — Deployment|ADR-017]] · [[05 Architecture Decisions#ADR-018 — CI/CD|ADR-018]] · [[05 Architecture Decisions#ADR-021 — Environment and configuration|ADR-021]] · [[Backup and Recovery]]

Operational deployment layout for Version 1: **Docker + Linux VPS + Caddy** (ADR-017). Managed Supabase PostgreSQL and Cloudflare R2 remain external to the application VPS.

## Environments

| Environment | `APP_ENV` | Purpose | Database / storage | Payment gateways | Typical URL |
| --- | --- | --- | --- | --- | --- |
| Local | `local` | Developer workstation | Local or dev Supabase; optional local disk storage | Test keys / fake adapter | `http://localhost:3000` |
| Development | `development` | Shared dev (optional) | Dev Supabase project | Test / sandbox | Team-specific |
| Staging / UAT | `staging` | Business acceptance, gateway sandbox tests, restore drills | **Dedicated** Supabase + R2 (never production) | **Sandbox only** — no live credentials | `https://uat.example.com` |
| Production | `production` | Live operations | Production Supabase + R2 | Live Stripe / PayPal | `https://app.example.com` |

Secrets are never committed. Each environment uses its own Supabase project, R2 bucket, Redis, Resend sender, Sentry project (optional), and gateway credential KEK keyring.

## Staging / UAT stack (TASK-102)

```text
Internet → Caddy → Next.js (web)
                      ├── Supabase Auth (UAT project)
                      ├── Supabase PostgreSQL (UAT project, external)
                      ├── Cloudflare R2 (UAT bucket)
                      ├── Resend
                      └── Stripe / PayPal sandbox
Worker → BullMQ → Redis (compose service)
```

Compose definition: `deploy/staging/docker-compose.yml`

| Container | Image target | Notes |
| --- | --- | --- |
| `web` | `runner-web` | `prisma migrate deploy` on start; serves Next.js standalone |
| `worker` | `runner-worker` | `pnpm worker` — webhooks, PDF, email, exports, notifications |
| `redis` | `redis:7-alpine` | Required for BullMQ in UAT |
| `caddy` | `caddy:2-alpine` | Reverse proxy; publish HTTP/HTTPS ports |

Runbook: `deploy/staging/README.md` · template: `deploy/staging/env.example`

## UAT data isolation

- Use a **separate** Supabase project for PostgreSQL and Auth.
- Use a **separate** R2 bucket with object versioning enabled.
- Generate unique `GATEWAY_CREDENTIALS_KEY_*` values; never reuse production KEKs.
- Configure company gateways in the UI with sandbox Stripe/PayPal credentials only.
- `pnpm restore:database` is permitted in staging without the production override.

## Health and smoke tests

- Load balancer / compose health: `GET /api/health` (database ping + queue/Sentry status).
- Post-deploy smoke (from CI or operator workstation):

  ```bash
  STAGING_SMOKE_URL=https://uat.example.com pnpm test:staging-smoke
  ```

  Skips automatically when `STAGING_SMOKE_URL` is unset (local CI).

## Production stack (TASK-103)

```text
Internet → Caddy (TLS) → Next.js (web)
                            ├── Supabase Auth (production project)
                            ├── Supabase PostgreSQL (production project, external)
                            ├── Cloudflare R2 (production bucket)
                            ├── Resend
                            └── Stripe / PayPal live
Worker → BullMQ → Redis (compose service)
```

Compose definition: `deploy/production/docker-compose.yml`

| Container | Image target | Notes |
| --- | --- | --- |
| `web` | `runner-web` | `prisma migrate deploy` on start; serves Next.js standalone |
| `worker` | `runner-worker` | `pnpm worker` — webhooks, PDF, email, exports, notifications |
| `redis` | `redis:7-alpine` | Required for BullMQ |
| `caddy` | `caddy:2-alpine` | Automatic HTTPS (Let's Encrypt); publishes host ports 80/443 |

Runbook: `deploy/production/README.md` · template: `deploy/production/env.example`

Pre-cutover checklist:

```bash
pnpm check:production-env -- deploy/production/env
```

Post-deploy smoke:

```bash
PRODUCTION_SMOKE_URL=https://app.example.com pnpm test:production-smoke
```

Production uses live gateway credentials (per company, ADR-022), Sentry monitoring, and daily `pnpm backup:database` when `BACKUP_DIR` is set. Enable Supabase PITR in addition to application dumps (ADR-024).

## CI / build

GitHub Actions (ADR-018) runs typecheck, lint, format check, unit tests, and production build on every push/PR. Staging and production deploys are operator-driven from the compose stacks.

## Related documentation

- [[Backup and Recovery]] — pg_dump + R2 versioning
- [[Settings]] — Admin operational health at `/settings/operations`
- [[05 Architecture Decisions#ADR-017 — Deployment|ADR-017]]
- [[TASK-102 Staging UAT Environment]] (complete)
- [[TASK-103 Production Deployment]] (complete)
