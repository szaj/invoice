# Staging / UAT deployment

Production-like acceptance environment on **Docker + Caddy** (ADR-017). Managed Supabase PostgreSQL and R2 remain **external** — use a dedicated UAT project and bucket, never production credentials.

## Prerequisites

- Docker Engine + Compose v2
- A **separate** Supabase project for UAT (database + Auth)
- A **separate** Cloudflare R2 bucket (enable object versioning)
- Resend API key (sandbox or UAT sender)
- Sandbox Stripe / PayPal credentials only
- Unique `GATEWAY_CREDENTIALS_KEY_*` values (never copy from production)

## Quick start

```bash
cd deploy/staging
cp env.example env
# Edit env — set APP_URL, Supabase, R2, Resend, sandbox gateway keys

docker compose up -d --build
```

The stack starts:

| Service | Role |
| --- | --- |
| `redis` | BullMQ queue backend |
| `web` | Next.js app (`prisma migrate deploy` on start, then `node server.js`) |
| `worker` | Background jobs (`pnpm worker`) |
| `caddy` | Reverse proxy / TLS termination |

Default published URL: `http://localhost:8080` (override with `UAT_HTTP_PORT`).

## Post-deploy

1. Create an Auth user in the **UAT** Supabase project (Auth console).
2. Bootstrap Admin in the application database (from a machine with UAT `DATABASE_URL`):

   ```bash
   pnpm bootstrap:admin -- --email admin@example.com
   ```

3. Configure company gateway credentials in the UI with **sandbox** Stripe/PayPal keys.
4. Run smoke test:

   ```bash
   STAGING_SMOKE_URL=http://localhost:8080 pnpm test:staging-smoke
   ```

## Health checks

- Load balancer / compose: `GET /api/health` on the web container
- Caddy proxies the same path on the published host port

## Data isolation

UAT must use:

- Separate Supabase PostgreSQL project
- Separate Supabase Auth project (same Supabase project as DB)
- Separate R2 bucket
- Separate Redis instance (included in compose, or external)
- Sandbox payment credentials only
- Unique gateway credential KEK keyring

Never point UAT at production database, storage, or live payment keys.

## Related

- Vault runbook: [[Deployment]]
- Backup drills: [[Backup and Recovery]]
