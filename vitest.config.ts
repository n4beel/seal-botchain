import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "test/**/*.test.ts"],
    // anvil needs a moment to boot before the first test can deploy.
    testTimeout: 30_000,
  },
});
