import "server-only";

import { Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";

import * as schema from "./schema";

// Neon's WebSocket driver (`neon-serverless`) supports interactive transactions,
// which booking needs (BEGIN … row locks … COMMIT). The HTTP driver (`neon-http`)
// sends one statement per request and can't hold a transaction open.
// Node.js 22+ provides the global WebSocket this driver uses.

let db: NeonDatabase<typeof schema> | undefined;

/**
 * Connects lazily, so builds and pages that never touch the database don't need
 * credentials. Use the pooled Neon connection string for DATABASE_URL.
 */
export function getDb() {
  if (!db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and add a Neon connection string.");
    }
    db = drizzle({ client: new Pool({ connectionString }), schema });
  }
  return db;
}

export type Database = NeonDatabase<typeof schema>;
export { schema };
