import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  loadEnv,
  PUBLIC_ENV_KEYS,
  requireSupabasePublicConfig,
  SERVER_SECRET_ENV_KEYS,
} from "@/config/env";
import { parseSupabasePublicConfig } from "@/config/env-schema";

const srcRoot = path.resolve(process.cwd(), "src");

function walkSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (entry === "generated") {
        continue;
      }
      files.push(...walkSourceFiles(fullPath));
      continue;
    }

    if (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }

  return files;
}

function uncommented(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
}

describe("auth environment", () => {
  it("does not expose the service role key to the browser", () => {
    expect(SERVER_SECRET_ENV_KEYS).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(PUBLIC_ENV_KEYS).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect("SUPABASE_SERVICE_ROLE_KEY".startsWith("NEXT_PUBLIC_")).toBe(false);
  });

  it("fails closed when public Supabase Auth config is missing", () => {
    expect(() => requireSupabasePublicConfig(loadEnv({ NODE_ENV: "test" }))).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
    expect(() => parseSupabasePublicConfig({})).toThrow(/required for authentication/);
  });

  it("accepts browser-safe Supabase values", () => {
    const env = loadEnv({
      NODE_ENV: "test",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    });

    expect(requireSupabasePublicConfig(env)).toEqual({
      url: "https://example.supabase.co",
      anonKey: "anon-key",
    });
  });
});

describe("authentication architecture boundary", () => {
  it("does not use Supabase Auth metadata for authorization", () => {
    const forbidden = [
      /user_metadata\.role\b/,
      /app_metadata\.role\b/,
      /user_metadata\.permissions\b/,
      /app_metadata\.permissions\b/,
      /user_metadata\.company_id\b/,
      /app_metadata\.company_id\b/,
      /user_metadata\.company_ids\b/,
      /app_metadata\.company_ids\b/,
    ];

    for (const file of walkSourceFiles(srcRoot)) {
      const source = uncommented(readFileSync(file, "utf8"));
      for (const pattern of forbidden) {
        expect(source, `${path.relative(srcRoot, file)} matches ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("does not create public signup", () => {
    const appRoot = path.join(srcRoot, "app");
    const files = walkSourceFiles(appRoot);

    expect(files.some((file) => file.includes(`${path.sep}signup${path.sep}`))).toBe(false);

    for (const file of walkSourceFiles(srcRoot)) {
      const source = uncommented(readFileSync(file, "utf8"));
      expect(source, path.relative(srcRoot, file)).not.toMatch(/\.signUp\s*\(/);
      expect(source, path.relative(srcRoot, file)).not.toMatch(/auth\.signUp\b/);
    }
  });

  it("keeps the users model as identity mapping only", () => {
    const schema = readFileSync(path.resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
    const userBlock = schema.slice(schema.indexOf("model User"), schema.indexOf('@@map("users")'));

    expect(userBlock).toContain("supabaseAuthUserId");
    expect(userBlock).toContain("lastLoginAt");
    expect(userBlock).not.toMatch(/\broleId\b/);
    expect(userBlock).not.toMatch(/\brole_id\b/);
    expect(userBlock).not.toMatch(/\bcompanyId\b/);
    expect(userBlock).not.toMatch(/\bpermission/);
    expect(userBlock).not.toMatch(/\bpasswordHash\b/);
  });
});
