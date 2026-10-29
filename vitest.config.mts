import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // `server-only` throws outside React Server Components; tests run server modules directly.
      { find: /^server-only$/, replacement: `${root}tests/support/server-only.ts` },
      { find: /^@\//, replacement: root },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integration tests run real migrations and the seed on in-memory PGlite.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
