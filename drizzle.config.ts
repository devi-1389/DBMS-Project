import { defineConfig } from "drizzle-kit";

// Load connection strings for CLI commands (studio, check). `generate` needs none.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // File not present: rely on the environment.
  }
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema/index.ts",
  out: "./drizzle",
  // Direct (unpooled) connection for DDL; falls back to the pooled URL.
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "" },
  strict: true,
  verbose: true,
});
