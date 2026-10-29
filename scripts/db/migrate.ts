// Applies drizzle/*.sql to the database in DATABASE_URL_UNPOOLED (or DATABASE_URL).
// Usage: npm run db:migrate
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";

import { connectionString, describeError, loadEnv, refuseProduction } from "./env";

async function main() {
  loadEnv();
  // Production migrations belong to the release pipeline (Phase 8), behind an explicit flag.
  refuseProduction("run migrations", process.argv.includes("--allow-production"));

  const pool = new Pool({ connectionString: connectionString({ direct: true }) });
  try {
    console.log("Applying migrations from ./drizzle …");
    await migrate(drizzle({ client: pool }), { migrationsFolder: "drizzle" });
    console.log("Migrations are up to date.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Migration failed: ${describeError(error)}`);
  process.exit(1);
});
