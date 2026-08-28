import { existsSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { E2E_SCENARIOS } from "./coverage";

test.describe("E2E delegated Vitest coverage sign-off (TASK-096)", () => {
  for (const scenario of E2E_SCENARIOS.filter((row) => row.kind === "integration-delegated")) {
    test(`${scenario.id} — signed off via integration suite`, () => {
      expect(scenario.integrationTests?.length).toBeGreaterThan(0);
      for (const relativePath of scenario.integrationTests ?? []) {
        const absolutePath = path.join(process.cwd(), relativePath);
        expect(existsSync(absolutePath), `${scenario.id} missing ${relativePath}`).toBe(true);
      }
    });
  }
});
