// Offline database verification. No credentials and no network: runs the real
// migrations, the seed, the integrity checks and every query in sql/queries.sql
// against PGlite (PostgreSQL compiled to WebAssembly, in memory).
// Usage: npm run db:verify
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "@/lib/db/schema";
import { decimalToMinor, minorToDecimal } from "@/lib/money";

import { runIntegrityChecks, runQueryFile, type CheckResult } from "./checks";
import { describeError } from "./env";
import { seedDatabase } from "./seed-database";

/** Queries that audit integrity and must return no rows. */
const AUDIT_QUERIES = ["Q07", "Q10"];

function moneyChecks(): CheckResult[] {
  const cases: [string, boolean][] = [
    ["money: 42000 minor units → '420.00'", minorToDecimal(42000) === "420.00"],
    ["money: 5 minor units → '0.05'", minorToDecimal(5) === "0.05"],
    ["money: '0.5' → 50 minor units", decimalToMinor("0.5") === 50],
    ["money: round trip is exact", decimalToMinor(minorToDecimal(1_234_567)) === 1_234_567],
  ];
  return cases.map(([name, ok]) => ({ name, ok }));
}

async function main() {
  const started = Date.now();
  const client = new PGlite();
  const db = drizzle({ client, schema });
  const run = async (text: string) => (await client.query<Record<string, unknown>>(text)).rows;

  console.log("Applying migrations to an in-memory PostgreSQL (PGlite) …");
  await migrate(db, { migrationsFolder: "drizzle" });
  const [{ version }] = await run("select version()");
  console.log(`  ${String(version).split(" on ")[0]}`);

  console.log("Seeding sample data …");
  await db.transaction((tx) => seedDatabase(tx, (message) => console.log(`  ${message}`)));

  console.log("Running integrity checks …");
  const checks = [...moneyChecks(), ...(await runIntegrityChecks(run))];
  for (const check of checks) {
    console.log(`  ${check.ok ? "PASS" : "FAIL"}  ${check.name}${check.ok || !check.detail ? "" : `  (${check.detail})`}`);
  }

  console.log("Running sql/queries.sql …");
  const queries = await runQueryFile(run, readFileSync("sql/queries.sql", "utf8"));
  const queryFailures: string[] = [];
  for (const query of queries) {
    const audit = AUDIT_QUERIES.some((id) => query.name.startsWith(id));
    const ok = !query.error && (audit ? query.rows.length === 0 : query.rows.length > 0);
    if (!ok) queryFailures.push(query.name);
    const detail = query.error ?? `${query.rows.length} row${query.rows.length === 1 ? "" : "s"}${audit ? " (audit: expects 0)" : ""}`;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${query.name}  (${detail})`);
  }

  const failed = checks.filter((check) => !check.ok).length + queryFailures.length;
  const total = checks.length + queries.length;
  console.log(`\n${total - failed}/${total} passed in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  await client.close();
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(`Verification failed: ${describeError(error)}`);
  process.exit(1);
});
