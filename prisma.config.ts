import { defineConfig } from "prisma/config";

import { loadEnvFiles } from "./src/config/load-env-files.ts";

loadEnvFiles();

/**
 * Prisma CLI (migrate, studio, introspect) must use the direct Postgres URL.
 * Application runtime uses pooled DATABASE_URL via the PrismaPg adapter.
 *
 * A localhost placeholder lets `prisma generate` run without credentials.
 * migrate/studio against that placeholder fail closed if DIRECT_URL is unset.
 */
const prismaCliUrl =
  process.env.DIRECT_URL?.trim() ||
  process.env.DATABASE_URL?.trim() ||
  "postgresql://prisma:prisma@127.0.0.1:5432/prisma";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: prismaCliUrl,
  },
});
