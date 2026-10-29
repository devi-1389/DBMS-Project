// Seeds a development database with sample data, in one transaction.
// Usage: npm run db:seed          (refuses if experiences already exist)
//        npm run db:seed:reset    (empties every table first)
import { Pool } from "@neondatabase/serverless";
import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";

import * as schema from "@/lib/db/schema";

import { connectionString, describeError, loadEnv, refuseProduction } from "./env";
import { resetDatabase, seedDatabase } from "./seed-database";

async function main() {
  loadEnv();
  refuseProduction("seed sample data");
  const reset = process.argv.includes("--reset");

  const pool = new Pool({ connectionString: connectionString({ direct: true }) });
  const db = drizzle({ client: pool, schema });
  try {
    const [{ value: existing }] = await db.select({ value: count() }).from(schema.experiences);
    if (existing > 0 && !reset) {
      console.error("The database already has experiences. Run `npm run db:seed:reset` to empty it and seed again.");
      process.exitCode = 1;
      return;
    }

    await db.transaction(async (tx) => {
      if (reset) {
        console.log("Emptying all tables …");
        await resetDatabase(tx);
      }
      console.log("Seeding sample data …");
      await seedDatabase(tx, (message) => console.log(`  ${message}`));
    });
    console.log("Seed complete.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Seed failed: ${describeError(error)}`);
  process.exit(1);
});
