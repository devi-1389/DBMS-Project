// A fresh in-memory PostgreSQL (PGlite) with the real migrations and the dev seed.
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import type { Viewer } from "@/lib/auth/types";
import { findViewerByUserId } from "@/lib/dal/identity";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { resortTime } from "@/lib/format";
import { seedDatabase } from "@/scripts/db/seed-database";

export type TestDb = { db: Db; client: PGlite; close: () => Promise<void> };

export async function createTestDb({ seed = true } = {}): Promise<TestDb> {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  if (seed) await db.transaction((tx) => seedDatabase(tx, () => {}));
  return { db, client, close: () => client.close() };
}

/** The seeded account with this email, as the app would see it after sign-in. */
export async function viewerByEmail(db: Db, email: string): Promise<Viewer> {
  const [user] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
  if (!user) throw new Error(`No seeded user ${email}`);
  const viewer = await findViewerByUserId(db, user.id);
  if (!viewer) throw new Error(`No viewer for ${email}`);
  return viewer;
}

/** Seeded accounts (scripts/db/seed-data.ts). */
export const SEEDED = {
  admin: "admin@example.com",
  staff: "mara@example.com",
  guest: "sample.guest@example.com",
} as const;

/** A resort-local (IST) date and time as an ISO instant, e.g. at("2026-11-03", "07:00"). */
export const at = (day: string, time: string) => resortTime(day, time).toISOString();

/** Before the seeded season (2–15 Nov 2026), so every seeded session is upcoming. */
export const BEFORE_SEASON = new Date("2026-10-29T12:00:00.000Z");
