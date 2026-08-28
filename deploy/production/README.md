# Production deployment

Live operations on **Docker + Caddy + TLS** (ADR-017). Managed Supabase PostgreSQL and Cloudflare R2 remain **external** to the application VPS. Use **live** Stripe / PayPal credentials only through company gateway configuration in the Admin UI.

## Prerequisites

- Linux VPS with Docker Engine + Compose v2
- DNS `A`/`AAAA` record for `PROD_DOMAIN` pointing to the VPS
- Production Supabase project (database + Auth) with **PITR** enabled (ADR-024)
- Production Cloudflare R2 bucket with **object versioning** enabled
- Resend API key and verified sender domain
- Unique `GATEWAY_CREDENTIALS_KEY_*` values (never copy from UAT)
- PostgreSQL client tools on the host for backup cron (`pg_dump`, `psql`, `gzip`)
- Optional: Sentry project for production error monitoring

## Least-privilege cloud credentials

| Service | Scope |
| --- | --- |
| Supabase | Service role key on server only; anon key public; restrict dashboard access |
| R2 | Bucket-scoped access key with read/write on the invoices bucket only |
| Resend | API key limited to send permissions |
| Stripe / PayPal | Live keys stored encrypted per company (ADR-022); webhook secrets per gateway |
| Sentry | Project-scoped DSN only |

Never commit filled `env` files. Never store secrets in `BACKUP_DIR`.

## Quick start

```bash
cd deploy/production
cp env.example env
# Edit env — production Supabase, R2, Resend, gateway KEK, APP_URL, backups

docker compose up -d --build
```

The stack starts:

| Service | Role |
| --- | --- |
| `redis` | BullMQ queue backend |
| `web` | Next.js app (`prisma migrate deploy` on start, then `node server.js`) |
| `worker` | Background jobs (`pnpm worker`) |
| `caddy` | Reverse proxy with automatic HTTPS (Let's Encrypt) |

Public URL: `https://<PROD_DOMAIN>` (ports 80/443 on the host).

## Post-deploy

1. Verify deployment checklist locally (from repo root):

   ```bash
   pnpm check:production-env -- deploy/production/env
   ```

2. Create an Auth user in the **production** Supabase project.
3. Bootstrap Admin (from a machine with production `DATABASE_URL`):

   ```bash
   pnpm bootstrap:admin -- --email admin@example.com
   ```

4. Configure company gateway credentials in the UI with **live** Stripe/PayPal keys.
5. Register Stripe/PayPal webhook endpoints pointing to `https://<PROD_DOMAIN>/api/webhooks/...`.
6. Run post-deploy smoke:

   ```bash
   PRODUCTION_SMOKE_URL=https://app.example.com pnpm test:production-smoke
   ```

7. Confirm Admin operational health at `/settings/operations` (gateway health, backup age, R2 versioning).

## Daily backups

Configure on the VPS host (example cron — adjust timezone and paths):

```cron
15 2 * * * cd /path/to/repo && /usr/bin/pnpm backup:database >> /var/log/invoices-backup.log 2>&1
```

Requires `BACKUP_DIR`, `DIRECT_URL` (or `DATABASE_URL`), and PostgreSQL client tools on the cron host. Production restore should prefer **Supabase PITR**; `pnpm restore:database` blocks production unless `BACKUP_RESTORE_ALLOW_PRODUCTION=true`.

## Health checks

- Load balancer / compose: `GET /api/health` on the web container
- Caddy proxies the same path on the public HTTPS URL

## Data isolation

Production must use:

- Dedicated Supabase PostgreSQL + Auth project (never UAT or dev)
- Dedicated R2 bucket with versioning
- Dedicated Redis instance (included in compose, or external)
- Live payment credentials only
- Unique gateway credential KEK keyring

Never point production at UAT database, storage, or sandbox payment keys.

## Related

- Vault runbook: [[Deployment]]
- Backup policy: [[Backup and Recovery]]
- Staging reference: `deploy/staging/README.md`
