import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { loadEnvFiles } from "@/config/load-env-files";

const probeKey = "TASK002_ENV_LOADER_PROBE";

describe("loadEnvFiles", () => {
  let directory: string | undefined;
  const previous = process.env[probeKey];

  afterEach(() => {
    if (previous === undefined) {
      delete process.env[probeKey];
    } else {
      process.env[probeKey] = previous;
    }

    if (directory) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("lets .env.local override .env when the key was not already supplied", () => {
    delete process.env[probeKey];
    directory = mkdtempSync(path.join(os.tmpdir(), "env-load-"));
    writeFileSync(path.join(directory, ".env"), `${probeKey}=from-env\n`);
    writeFileSync(path.join(directory, ".env.local"), `${probeKey}=from-local\n`);

    loadEnvFiles({ cwd: directory });

    expect(process.env[probeKey]).toBe("from-local");
  });

  it("keeps an already supplied process environment value", () => {
    process.env[probeKey] = "from-process";
    directory = mkdtempSync(path.join(os.tmpdir(), "env-load-"));
    writeFileSync(path.join(directory, ".env"), `${probeKey}=from-env\n`);
    writeFileSync(path.join(directory, ".env.local"), `${probeKey}=from-local\n`);

    loadEnvFiles({ cwd: directory });

    expect(process.env[probeKey]).toBe("from-process");
  });
});
