# Plesk Docker deployment

Production stack on **Plesk + Docker Compose** (ADR-017 alternate host). Plesk nginx owns ports 80/443 and Let's Encrypt TLS. Managed Supabase PostgreSQL and Cloudflare R2 remain **external** to the Plesk VPS.

Do **not** use the Caddy service from `deploy/production` on a Plesk host — it will conflict with Plesk on ports 80/443.

## Architecture

```text
Internet → Plesk nginx (TLS) → 127.0.0.1:3000 → Next.js (web)
                                                    ├── Supabase Auth / PostgreSQL
                                                    ├── Cloudflare R2
                                                    └── Resend
Worker → BullMQ → Redis (compose service)
```

## Prerequisites

- Plesk with the **Docker** extension installed
- Docker Engine + Compose v2 (SSH or Plesk Docker UI)
- Domain in Plesk with DNS `A`/`AAAA` pointing at the server
- Production Supabase project (database + Auth) with **PITR** enabled (ADR-024)
- Production Cloudflare R2 bucket with **object versioning** enabled
- Resend API key and verified sender domain
- Unique `GATEWAY_CREDENTIALS_KEY_*` values (never copy from UAT)
- PostgreSQL client tools on the host for backup cron (`pg_dump`, `psql`, `gzip`)
- Optional: Sentry project for production error monitoring

## Quick start

### 1. Place the repo on the server

Clone or upload the repository to a path the Plesk user (or root over SSH) can build from, for example `/var/www/vhosts/example.com/invoices`.

### 2. Configure environment

```bash
cd deploy/plesk
cp env.example env
# Edit env — production Supabase, R2, Resend, gateway KEK, APP_URL, backups
# APP_URL must be the public HTTPS URL of the Plesk domain, e.g. https://app.example.com
```

### 3. Start the stack

```bash
docker compose up -d --build
```

| Service | Role |
| --- | --- |
| `redis` | BullMQ queue backend (internal network only) |
| `web` | Next.js app (`prisma migrate deploy` on start); published as `127.0.0.1:3000` |
| `worker` | Background jobs (`pnpm worker`) |

### 4. Domain, SSL, and reverse proxy in Plesk

1. **Domains** → select (or create) the domain that matches `APP_URL`.
2. **SSL/TLS Certificates** → get a free certificate via Let's Encrypt; enable “Redirect from HTTP to HTTPS”.
3. Point traffic at the web container using one of:

   **Option A — Docker Proxy Rules** (preferred when the extension exposes it):
   - Open the domain’s **Docker Proxy Rules**
   - Map the domain (and optionally `/`) to the `web` container port `3000`

   **Option B — nginx additional directives** (Apache+nginx or nginx-only):

   ```nginx
   location / {
       proxy_pass http://127.0.0.1:3000;
       proxy_http_version 1.1;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
   }
   ```

4. Confirm the document root / hosting type does not serve static files that bypass the proxy for app routes.

### 5. Verify

```bash
curl -fsS https://app.example.com/api/health
```

Expect a healthy JSON response (database ping + queue status).

## Post-deploy

1. Verify environment checklist locally (from repo root):

   ```bash
   pnpm check:production-env -- deploy/plesk/env
   ```

2. Create an Auth user in the **production** Supabase project.
3. Bootstrap Admin (from a machine with production `DATABASE_URL`):

   ```bash
   pnpm bootstrap:admin -- --email admin@example.com
   ```

4. Configure company gateway credentials in the UI with **live** Stripe/PayPal keys.
5. Register Stripe/PayPal webhook endpoints pointing to `https://<your-domain>/api/webhooks/...`.
6. Run post-deploy smoke:

   ```bash
   PRODUCTION_SMOKE_URL=https://app.example.com pnpm test:production-smoke
   ```

7. Confirm Admin operational health at `/settings/operations`.

## Daily backups

Configure on the Plesk host (example cron — adjust timezone and paths):

```cron
15 2 * * * cd /path/to/repo && /usr/bin/pnpm backup:database >> /var/log/invoices-backup.log 2>&1
```

Requires `BACKUP_DIR`, `DIRECT_URL` (or `DATABASE_URL`), and PostgreSQL client tools on the cron host. Prefer **Supabase PITR** for restores; `pnpm restore:database` blocks production unless `BACKUP_RESTORE_ALLOW_PRODUCTION=true`.

## Updates

```bash
cd /path/to/repo
git pull
cd deploy/plesk
docker compose up -d --build
```

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Port 80/443 already in use when starting old production compose | You started `deploy/production` (Caddy) on Plesk — use `deploy/plesk` instead |
| 502 Bad Gateway from Plesk | `web` not healthy, or proxy not aimed at `127.0.0.1:3000` |
| Health OK on localhost but not HTTPS | SSL or proxy rules missing; check Plesk domain proxy |
| Auth / webhook URL mismatches | `APP_URL` does not match the public Plesk domain |

## Data isolation

Production must use:

- Dedicated Supabase PostgreSQL + Auth project (never UAT or dev)
- Dedicated R2 bucket with versioning
- Dedicated Redis instance (included in compose)
- Live payment credentials only
- Unique gateway credential KEK keyring

## Related

- Vault runbook: [[Deployment]]
- Backup policy: [[Backup and Recovery]]
- Bare VPS + Caddy: `deploy/production/README.md`
- Staging reference: `deploy/staging/README.md`
