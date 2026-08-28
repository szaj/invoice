import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  assessProductionDeploymentReadiness,
  parseDotenvFile,
} from "@/domain/ops/production-smoke";

function main(): void {
  const pathArg = process.argv[2];

  if (!pathArg) {
    console.error("Usage: pnpm check:production-env -- <path-to-env-file>");
    process.exit(1);
  }

  const envPath = resolve(pathArg);
  const content = readFileSync(envPath, "utf8");
  const env = parseDotenvFile(content);
  const assessment = assessProductionDeploymentReadiness(env);

  if (assessment.warnings.length > 0) {
    console.warn("Warnings:");
    for (const warning of assessment.warnings) {
      console.warn(`  - ${warning}`);
    }
  }

  if (!assessment.ready) {
    console.error("Production deployment checklist failed:");
    for (const item of assessment.missingRequired) {
      console.error(`  - ${item}`);
    }
    process.exit(1);
  }

  console.log(`Production deployment checklist passed for ${envPath}`);
}

main();
