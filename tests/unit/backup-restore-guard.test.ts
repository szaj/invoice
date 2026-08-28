import { describe, expect, it } from "vitest";

import { assertRestoreAllowed } from "@/domain/backup/restore-guard";

describe("backup restore guard (TASK-101)", () => {
  it("refuses to restore from environment files", () => {
    const result = assertRestoreAllowed({
      appEnv: "staging",
      restoreAllowProduction: false,
      artifactPath: "/var/backups/.env.production",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/secret file/i);
    }
  });

  it("blocks production restore unless explicitly allowed", () => {
    const blocked = assertRestoreAllowed({
      appEnv: "production",
      restoreAllowProduction: false,
      artifactPath: "/var/backups/database-2026-08-28.sql.gz",
    });
    expect(blocked.ok).toBe(false);

    const allowed = assertRestoreAllowed({
      appEnv: "production",
      restoreAllowProduction: true,
      artifactPath: "/var/backups/database-2026-08-28.sql.gz",
    });
    expect(allowed.ok).toBe(true);
  });

  it("allows non-production restore from pg_dump artifacts", () => {
    const result = assertRestoreAllowed({
      appEnv: "staging",
      restoreAllowProduction: false,
      artifactPath: "/var/backups/database-2026-08-28.sql.gz",
    });
    expect(result.ok).toBe(true);
  });
});
