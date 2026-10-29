// Read-only check of the configured database: can we connect, which migrations are
// applied, and how much data is there. Prints no connection details.
// Usage: npm run db:status
import { Pool } from "@neondatabase/serverless";

import { connectionString, describeError, loadEnv } from "./env";

async function main() {
  loadEnv();
  const pool = new Pool({ connectionString: connectionString({ direct: true }) });
  try {
    const one = async (text: string) => (await pool.query(text)).rows[0] as Record<string, unknown>;
    const { version } = await one("select split_part(version(), ' on ', 1) as version");
    console.log(`Connected: ${String(version)}`);

    const { tables, views } = await one(`
      select count(*) filter (where table_type = 'BASE TABLE') as tables,
             count(*) filter (where table_type = 'VIEW') as views
        from information_schema.tables
       where table_schema = 'public'`);
    console.log(`Tables: ${String(tables)} (expected 27) · views: ${String(views)} (expected 3)`);

    const journal = await one("select to_regclass('drizzle.__drizzle_migrations') is not null as present");
    const migrations = journal.present ? (await one("select count(*) as n from drizzle.__drizzle_migrations")).n : 0;
    console.log(`Migrations applied: ${String(migrations)} (expected 5)`);

    if (Number(tables) > 0) {
      const counts = await one(`
        select (select count(*) from experiences) as experiences,
               (select count(*) from experience_slots) as sessions,
               (select count(*) from users) as users,
               (select count(*) from users where role = 'admin') as admins,
               (select count(*) from bookings) as bookings`);
      console.log(
        `Data: ${String(counts.experiences)} experiences, ${String(counts.sessions)} sessions, ${String(counts.users)} users ` +
          `(${String(counts.admins)} admin), ${String(counts.bookings)} bookings`,
      );
      if (Number(counts.experiences) === 0) console.log("No experiences yet: run the seed so guests have something to plan.");
    } else {
      console.log("The database is empty: run the migrations.");
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Status check failed: ${describeError(error)}`);
  process.exit(1);
});
