import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  loadEnv,
  PUBLIC_ENV_KEYS,
  requireDirectDatabaseUrl,
  requireRuntimeDatabaseUrl,
  SERVER_SECRET_ENV_KEYS,
} from "@/config/env";
import { DATABASE_CONVENTIONS, FORBIDDEN_MONEY_PRISMA_TYPES } from "@/server/db/conventions";

const schemaPath = path.resolve(process.cwd(), "prisma/schema.prisma");
const configPath = path.resolve(process.cwd(), "prisma.config.ts");
const migrationPath = path.resolve(
  process.cwd(),
  "prisma/migrations/20260820120000_database_foundation/migration.sql",
);

describe("database environment", () => {
  it("does not expose database secrets as NEXT_PUBLIC_ keys", () => {
    for (const key of SERVER_SECRET_ENV_KEYS) {
      expect(key.startsWith("NEXT_PUBLIC_")).toBe(false);
      expect(PUBLIC_ENV_KEYS).not.toContain(key);
    }
  });

  it("allows boot without database credentials", () => {
    const env = loadEnv({ NODE_ENV: "test" });
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.DIRECT_URL).toBeUndefined();
  });

  it("rejects a non-postgres DATABASE_URL", () => {
    expect(() =>
      loadEnv({
        NODE_ENV: "test",
        DATABASE_URL: "https://example.com/not-postgres",
      }),
    ).toThrow(/PostgreSQL connection URL/);
  });

  it("accepts a postgresql connection URL", () => {
    const env = loadEnv({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
      DIRECT_URL: "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
    });

    expect(env.DATABASE_URL).toContain("postgresql://");
    expect(requireRuntimeDatabaseUrl(env)).toBe(env.DATABASE_URL);
    expect(requireDirectDatabaseUrl(env)).toBe(env.DIRECT_URL);
  });

  it("fails closed when runtime database access is required without DATABASE_URL", () => {
    expect(() => requireRuntimeDatabaseUrl(loadEnv({ NODE_ENV: "test" }))).toThrow(
      /DATABASE_URL is required/,
    );
  });
});

describe("prisma schema conventions", () => {
  it("targets PostgreSQL with identity, RBAC, and company models only", () => {
    const schema = readFileSync(schemaPath, "utf8");

    expect(schema).toContain('provider = "postgresql"');
    expect(schema).toContain("@db.Decimal(19, 4)");
    expect(schema).toContain("@db.Decimal(20, 12)");
    expect(schema).toContain("@db.Timestamptz");
    expect(schema).toContain("company_id");
    expect(schema).toMatch(/model User\b/);
    expect(schema).toMatch(/model Company\b/);
    expect(schema).not.toMatch(/model\s+(Customer|Invoice|Payment)\b/);

    const uncommented = schema
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");

    for (const forbidden of FORBIDDEN_MONEY_PRISMA_TYPES) {
      expect(uncommented).not.toMatch(new RegExp(`\\b${forbidden}\\b`));
    }
  });

  it("points Prisma CLI at DIRECT_URL", () => {
    const config = readFileSync(configPath, "utf8");
    expect(config).toContain("DIRECT_URL");
    expect(config).toContain("prisma/migrations");
  });

  it("ships a non-destructive foundation migration", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("CREATE EXTENSION IF NOT EXISTS");
    expect(sql).toContain("pgcrypto");
    expect(sql.toLowerCase()).not.toContain("drop database");
    expect(sql.toLowerCase()).not.toMatch(/create table\s+(users|invoices|payments|companies)/);
  });

  it("documents Decimal money mapping", () => {
    expect(DATABASE_CONVENTIONS.money.native).toBe("NUMERIC(19, 4)");
    expect(DATABASE_CONVENTIONS.conversionRate.native).toBe("NUMERIC(20, 12)");
  });
});
