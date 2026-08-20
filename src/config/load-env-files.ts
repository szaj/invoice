import path from "node:path";

import { config as loadDotenv } from "dotenv";

export interface LoadEnvFilesOptions {
  cwd?: string;
}

/**
 * Load `.env` then `.env.local`.
 * Explicit process environment already present wins over both files.
 * Does not log secret values.
 */
export function loadEnvFiles(options: LoadEnvFilesOptions = {}): void {
  const cwd = options.cwd ?? process.cwd();
  const supplied = { ...process.env };

  loadDotenv({
    path: path.resolve(cwd, ".env"),
    override: false,
    quiet: true,
  });
  loadDotenv({
    path: path.resolve(cwd, ".env.local"),
    override: true,
    quiet: true,
  });

  for (const [key, value] of Object.entries(supplied)) {
    if (value !== undefined) {
      process.env[key] = value;
    }
  }
}
