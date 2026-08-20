import path from "node:path";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["./tests/setup/integration-env.ts"],
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(root, "./src"),
      "server-only": path.resolve(root, "./tests/shims/server-only.ts"),
    },
  },
});
