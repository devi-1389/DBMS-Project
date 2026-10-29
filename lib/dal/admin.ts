import "server-only";

import type { Viewer } from "@/lib/auth/types";
import type { Db } from "@/lib/db/types";

import { listAllBookings } from "./bookings";
import { listCatalogue } from "./catalogue";
import { AuthorizationError } from "./errors";
import { listUsers } from "./users";

/** Everything the admin console shows, from the database. Administrators only. */
export async function getAdminConsoleData(db: Db, actor: Viewer, window: { from: Date; to: Date }) {
  if (actor.role !== "admin") throw new AuthorizationError("Only administrators can open the admin console.");
  const catalogue = await listCatalogue(db, window);
  const bookings = await listAllBookings(db, actor);
  const users = await listUsers(db, actor);
  return { ...catalogue, bookings, users };
}
