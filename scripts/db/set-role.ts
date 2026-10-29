// Operator bootstrap: grants a role to an existing account by email. This is the only
// way to create the first administrator; after that, administrators use /admin → Users.
// Usage: npm run db:set-role -- <email> <guest|staff|admin> [--allow-production]
// The person must have signed in once so their account exists.
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

import { isRole, ROLES } from "@/lib/auth/roles";
import * as schema from "@/lib/db/schema";
import { setRoleByEmail } from "@/lib/dal/users";

import { connectionString, describeError, loadEnv, refuseProduction } from "./env";

async function main() {
  loadEnv();
  const args = process.argv.slice(2);
  const [email, role] = args.filter((arg) => !arg.startsWith("--"));
  if (!email || !role || !isRole(role)) {
    console.error(`Usage: npm run db:set-role -- <email> <${ROLES.join("|")}> [--allow-production]`);
    process.exitCode = 1;
    return;
  }
  refuseProduction("change a role", args.includes("--allow-production"));

  const pool = new Pool({ connectionString: connectionString({ direct: true }) });
  try {
    const target = await setRoleByEmail(drizzle({ client: pool, schema }), email, role);
    if (!target) {
      console.error("No account with that email. Ask the person to sign in once, then run this again.");
      process.exitCode = 1;
      return;
    }
    console.log(`${target.displayName} is now ${role}.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Role change failed: ${describeError(error)}`);
  process.exitCode = 1;
});
