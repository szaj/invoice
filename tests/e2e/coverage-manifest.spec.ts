import { existsSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { E2E_SCENARIO_IDS, E2E_SCENARIOS } from "./coverage";

test.describe("E2E coverage manifest (TASK-096)", () => {
  test("registers E2E-01 through E2E-17", () => {
    expect(E2E_SCENARIOS.map((row) => row.id)).toEqual([...E2E_SCENARIO_IDS]);
  });

  test("every Playwright or hybrid scenario has a spec file", () => {
    for (const scenario of E2E_SCENARIOS) {
      if (scenario.kind === "integration-delegated") {
        continue;
      }
      expect(scenario.spec, `${scenario.id} missing spec`).toBeTruthy();
      const specPath = path.join(__dirname, scenario.spec!);
      expect(existsSync(specPath), `${scenario.id} spec missing at ${scenario.spec}`).toBe(true);
    }
  });

  test("every integration-delegated scenario references existing Vitest files", () => {
    for (const scenario of E2E_SCENARIOS) {
      if (scenario.kind === "playwright") {
        continue;
      }
      expect(
        scenario.integrationTests?.length,
        `${scenario.id} missing integrationTests`,
      ).toBeGreaterThan(0);
      for (const relativePath of scenario.integrationTests ?? []) {
        const absolutePath = path.join(process.cwd(), relativePath);
        expect(existsSync(absolutePath), `${scenario.id} → ${relativePath}`).toBe(true);
      }
    }
  });
});
