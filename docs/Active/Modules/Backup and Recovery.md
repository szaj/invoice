---
type: module
status: approved
phase: 9
domain: ops
tags:
  - module
---

# Backup and Recovery

> [!abstract] Related
> [[Settings]] · [[05 Architecture Decisions#ADR-024 — Backup and recovery|ADR-024]] · [[00 Home]]

Operational backup and restore for **Supabase PostgreSQL** (managed externally per ADR-017) and **Cloudflare R2** object storage (ADR-006).

## Policy

| Asset | Minimum | Production recommendation |
| --- | --- | --- |
| PostgreSQL | Daily automated `pg_dump` when `BACKUP_DIR` is configured | Enable Supabase **PITR** in addition to application dumps |
| PDFs / object storage | R2 **object versioning** in staging/production | Restrict bucket IAM; never store `.env` or credential files in backup paths |
| Secrets | **Never** backed up as plaintext files | Use Supabase/R2/Resend/provider consoles for credential rotation |

Backup storage must be **Admin-restricted** at the filesystem or object-store ACL layer. The application never exposes backup artifacts through public APIs.

## Database backup

Configure on the application VPS (or CI maintenance host with DB network access):

```text
BACKUP_DIR=/var/backups/invoices
BACKUP_RETENTION_DAYS=30
BACKUP_MAX_AGE_HOURS=26
```

Run daily via cron (example — adjust timezone and user):

```cron
15 2 * * * cd /app && /usr/bin/pnpm backup:database >> /var/log/invoices-backup.log 2>&1
```

The script:

1. Uses `DIRECT_URL` (or `DATABASE_URL`) for `pg_dump` — credentials stay in environment variables, not in artifacts.
2. Writes `database-<timestamp>.sql.gz` under `BACKUP_DIR`.
3. Updates `.last-success.json` for Admin health indicators (`/settings/operations`).
4. Prunes dumps older than `BACKUP_RETENTION_DAYS`.
5. Refuses unsafe `BACKUP_DIR` values that reference `.env` files.

Requires PostgreSQL client tools (`pg_dump`, `psql`, `gzip`) on the host.

## Database restore (non-production)

Restore is for **staging/UAT** verification and disaster-recovery drills. Production restore should prefer **Supabase PITR**; application scripts are blocked unless explicitly overridden.

```text
pnpm restore:database /var/backups/invoices/database-2026-08-28T02-15-00-000Z.sql.gz
```

Guardrails:

- `APP_ENV=production` requires `BACKUP_RESTORE_ALLOW_PRODUCTION=true` (emergency only).
- Artifact paths matching `.env` are rejected.
- Test the procedure periodically in staging and record the date in change-management notes.

## Object storage (R2)

Invoice PDFs, branding assets, and report exports live in R2 via `StorageService`. Enable **bucket versioning** in the Cloudflare dashboard for staging and production buckets. Versioning satisfies immutable historical document retention without copying bucket contents to the VPS.

Admin operational health checks R2 versioning when credentials are configured.

## Monitoring

TASK-101 extends Admin `/settings/operations` with backup indicators:

- Last successful database dump (from `.last-success.json`)
- R2 versioning status
- PITR recommendation in production

Restricted to `settings.manage` (Admin).

## Related Documentation

- [[05 Architecture Decisions#ADR-017 — Deployment|ADR-017]]
- [[05 Architecture Decisions#ADR-006 — Object storage|ADR-006]]
- [[TASK-101 Backup and Recovery]]
