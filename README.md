Internal multi-brand invoice management platform.

Application implementation lives in this repository. Authoritative product and architecture notes are in [`docs/00 Home.md`](docs/00%20Home.md).

Use `pnpm` as the package manager.

## Database (Prisma + Supabase PostgreSQL)

Copy `.env.example` to `.env` and `.env.local`. Set `DATABASE_URL` (pooled runtime) and `DIRECT_URL` (Prisma migrations). Never expose these to the client.

```text
pnpm prisma:generate
pnpm prisma:migrate:dev
```

Details: [`docs/Technical/Database.md`](docs/Technical/Database.md).

## Authentication (Supabase Auth identity)

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. There is no public signup. Accounts are provisioned later by an administrator.

Authentication proves identity only. Application authorization (roles, permissions, company access) is not implemented yet.

Details: [`docs/Technical/Authentication.md`](docs/Technical/Authentication.md).
