import "server-only";

import { and, eq, sql } from "drizzle-orm";

import type { VerifiedIdentity, Viewer } from "@/lib/auth/types";
import { authIdentities, guestProfiles, staffMembers, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";

import { pgErrorCode } from "./errors";

const viewerColumns = {
  userId: users.id,
  role: users.role,
  email: users.email,
  displayName: users.displayName,
  staffId: staffMembers.id,
  staffActive: staffMembers.isActive,
};

type ViewerRow = {
  userId: string;
  role: Viewer["role"];
  email: string;
  displayName: string;
  staffId: string | null;
  staffActive: boolean | null;
};

const toViewer = (row: ViewerRow): Viewer => ({
  userId: row.userId,
  role: row.role,
  email: row.email,
  displayName: row.displayName,
  staffId: row.staffActive ? row.staffId : null,
});

/** The user linked to a provider identity, or null if it hasn't been provisioned. */
export async function findViewer(db: Db, identity: Pick<VerifiedIdentity, "provider" | "providerUserId">) {
  const [row] = await db
    .select(viewerColumns)
    .from(authIdentities)
    .innerJoin(users, eq(users.id, authIdentities.userId))
    .leftJoin(staffMembers, eq(staffMembers.userId, users.id))
    .where(and(eq(authIdentities.provider, identity.provider), eq(authIdentities.providerUserId, identity.providerUserId)))
    .limit(1);
  return row ? toViewer(row) : null;
}

export async function findViewerByUserId(db: Db, userId: string) {
  const [row] = await db
    .select(viewerColumns)
    .from(users)
    .leftJoin(staffMembers, eq(staffMembers.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  return row ? toViewer(row) : null;
}

function namesFor(identity: VerifiedIdentity) {
  const local = identity.email.split("@")[0].slice(0, 80) || "Guest";
  const first = identity.firstName?.trim().slice(0, 80) || local;
  const last = identity.lastName?.trim().slice(0, 80) ?? "";
  const display = `${first} ${last}`.trim().slice(0, 120);
  return { first, last, display };
}

export type ProvisionResult =
  | { ok: true; viewer: Viewer; created: boolean }
  | { ok: false; code: "identity-conflict"; message: string };

/**
 * Links a verified provider identity to a user, creating a guest account on first
 * sign-in. New accounts are always "guest"; the identity carries no role, so signing
 * up can never grant staff or admin rights. An existing account is linked only by a
 * provider-verified email, and only if it isn't already linked to another identity.
 */
export async function provisionViewer(db: Db, identity: VerifiedIdentity): Promise<ProvisionResult> {
  const existing = await findViewer(db, identity);
  if (existing) return { ok: true, viewer: existing, created: false };

  const names = namesFor(identity);
  try {
    return await db.transaction(async (tx) => {
      const [byEmail] = await tx
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.email}) = lower(${identity.email})`)
        .limit(1);

      let userId: string;
      let created = false;
      if (byEmail) {
        const [linked] = await tx
          .select({ id: authIdentities.id })
          .from(authIdentities)
          .where(and(eq(authIdentities.userId, byEmail.id), eq(authIdentities.provider, identity.provider)))
          .limit(1);
        if (linked) {
          return {
            ok: false as const,
            code: "identity-conflict" as const,
            message: "This email is already linked to a different sign-in account. Please contact the resort team.",
          };
        }
        userId = byEmail.id;
      } else {
        const [user] = await tx
          .insert(users)
          .values({ email: identity.email, displayName: names.display, role: "guest" })
          .returning({ id: users.id });
        userId = user.id;
        created = true;
      }

      await tx.insert(authIdentities).values({
        userId,
        provider: identity.provider,
        providerUserId: identity.providerUserId,
        lastSignInAt: new Date(),
      });
      await tx
        .insert(guestProfiles)
        .values({ userId, firstName: names.first, lastName: names.last })
        .onConflictDoNothing();

      const viewer = await findViewer(tx, identity);
      return { ok: true as const, viewer: viewer!, created };
    });
  } catch (error) {
    // Two first requests for the same new user can race; the loser reads the winner's row.
    if (pgErrorCode(error) === "23505") {
      const viewer = await findViewer(db, identity);
      if (viewer) return { ok: true, viewer, created: false };
    }
    throw error;
  }
}

/** Webhook `user.updated`: keep email and name current. Never touches the role. */
export async function syncIdentityProfile(db: Db, identity: VerifiedIdentity) {
  const viewer = await findViewer(db, identity);
  if (!viewer) return false;
  const names = namesFor(identity);
  try {
    await db.update(users).set({ email: identity.email, displayName: names.display }).where(eq(users.id, viewer.userId));
  } catch (error) {
    // Another account already uses this email: keep the old one rather than fail the webhook.
    if (pgErrorCode(error) !== "23505") throw error;
  }
  await db
    .update(guestProfiles)
    .set({ firstName: names.first, lastName: names.last })
    .where(eq(guestProfiles.userId, viewer.userId));
  return true;
}

/**
 * Webhook `user.deleted`: remove the sign-in link. The user's bookings, payments and
 * history stay (they're protected by RESTRICT), but nobody can sign in as them.
 */
export async function unlinkIdentity(db: Db, identity: Pick<VerifiedIdentity, "provider" | "providerUserId">) {
  const removed = await db
    .delete(authIdentities)
    .where(and(eq(authIdentities.provider, identity.provider), eq(authIdentities.providerUserId, identity.providerUserId)))
    .returning({ id: authIdentities.id });
  return removed.length > 0;
}
