import "server-only";

import { asc, count, eq, sql } from "drizzle-orm";

import { ROLE_LABELS, type UserRole } from "@/lib/auth/roles";
import type { Viewer } from "@/lib/auth/types";
import { authIdentities, staffMembers, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import type { ManagedUser } from "@/lib/types/user";

import { AuthorizationError, fail, ok, type DalResult } from "./errors";

function requireAdmin(actor: Viewer) {
  if (actor.role !== "admin") throw new AuthorizationError("Only administrators can manage users.");
}

export async function listUsers(db: Db, actor: Viewer): Promise<ManagedUser[]> {
  requireAdmin(actor);
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      createdAt: users.createdAt,
      identities: count(authIdentities.id),
    })
    .from(users)
    .leftJoin(authIdentities, eq(authIdentities.userId, users.id))
    .groupBy(users.id)
    .orderBy(asc(users.displayName));
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
    canSignIn: row.identities > 0,
    createdAt: row.createdAt.toISOString(),
  }));
}

/** Applies a role and keeps the staff record in step (active only while role is staff). */
async function applyRole(tx: Db, user: { id: string; displayName: string; email: string }, role: UserRole) {
  await tx.update(users).set({ role }).where(eq(users.id, user.id));
  if (role === "staff") {
    await tx
      .insert(staffMembers)
      .values({ userId: user.id, displayName: user.displayName, jobTitle: "Staff", email: user.email })
      .onConflictDoUpdate({ target: staffMembers.userId, set: { isActive: true } });
  } else {
    await tx.update(staffMembers).set({ isActive: false }).where(eq(staffMembers.userId, user.id));
  }
}

/**
 * Admin-only role change. The actor's role is re-read from the database under a row
 * lock (not trusted from the session), an admin can't change their own role, and the
 * last administrator can't be demoted.
 */
export async function changeUserRole(
  db: Db,
  actor: Viewer,
  input: { userId: string; role: UserRole },
): Promise<DalResult<{ userId: string; role: UserRole }>> {
  requireAdmin(actor);
  if (input.userId === actor.userId) {
    return fail("self-change", "You can't change your own role. Ask another administrator.");
  }

  return db.transaction(async (tx) => {
    const [actorRow] = await tx.select({ role: users.role }).from(users).where(eq(users.id, actor.userId)).for("update");
    if (actorRow?.role !== "admin") throw new AuthorizationError("Only administrators can manage users.");

    const [target] = await tx
      .select({ id: users.id, role: users.role, displayName: users.displayName, email: users.email })
      .from(users)
      .where(eq(users.id, input.userId))
      .for("update");
    if (!target) return fail("not-found", "That user doesn't exist.");
    if (target.role === input.role) return ok({ userId: target.id, role: target.role }, "No change needed.");

    if (target.role === "admin") {
      const [{ admins }] = await tx.select({ admins: count() }).from(users).where(eq(users.role, "admin"));
      if (admins <= 1) return fail("last-admin", "At least one administrator must remain.");
    }

    await applyRole(tx, target, input.role);
    return ok(
      { userId: target.id, role: input.role },
      `${target.displayName} is now ${ROLE_LABELS[input.role].toLowerCase()}.`,
    );
  });
}

/**
 * Operator bootstrap (scripts/db/set-role.ts): grants a role by email with database
 * access only. There is no web route to this function.
 */
export async function setRoleByEmail(db: Db, email: string, role: UserRole) {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: users.id, displayName: users.displayName, email: users.email })
      .from(users)
      .where(sql`lower(${users.email}) = lower(${email})`)
      .for("update");
    if (!target) return null;
    await applyRole(tx, target, role);
    return target;
  });
}
