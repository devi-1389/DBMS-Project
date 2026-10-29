import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { VerifiedIdentity } from "@/lib/auth/types";
import { AuthorizationError } from "@/lib/dal/errors";
import { findViewer, provisionViewer, syncIdentityProfile, unlinkIdentity } from "@/lib/dal/identity";
import { changeUserRole, listUsers, setRoleByEmail } from "@/lib/dal/users";
import { authIdentities, guestProfiles, staffMembers, users } from "@/lib/db/schema";
import { createTestDb, SEEDED, viewerByEmail, type TestDb } from "@/tests/support/db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(() => t.close());

const identity = (overrides: Partial<VerifiedIdentity> = {}): VerifiedIdentity => ({
  provider: "clerk",
  providerUserId: `user_${Math.random().toString(36).slice(2)}`,
  email: `new.${Math.random().toString(36).slice(2)}@example.org`,
  firstName: "Ada",
  lastName: "Byron",
  ...overrides,
});

describe("provisionViewer", () => {
  it("creates a guest account, profile and identity link on first sign-in", async () => {
    const person = identity();
    const result = await provisionViewer(t.db, person);
    expect(result.ok && result.created).toBe(true);
    if (!result.ok) return;
    expect(result.viewer).toMatchObject({ role: "guest", email: person.email, displayName: "Ada Byron", staffId: null });

    const [profile] = await t.db.select().from(guestProfiles).where(eq(guestProfiles.userId, result.viewer.userId));
    expect(profile).toMatchObject({ firstName: "Ada", lastName: "Byron" });
    expect(await findViewer(t.db, person)).toEqual(result.viewer);
  });

  it("is idempotent for the same provider ID", async () => {
    const person = identity();
    const first = await provisionViewer(t.db, person);
    const second = await provisionViewer(t.db, person);
    expect(second.ok && !second.created).toBe(true);
    expect(first.ok && second.ok && first.viewer.userId === second.viewer.userId).toBe(true);
    const links = await t.db.select().from(authIdentities).where(eq(authIdentities.providerUserId, person.providerUserId));
    expect(links).toHaveLength(1);
  });

  it("handles a missing name with the email's local part", async () => {
    const result = await provisionViewer(t.db, identity({ email: "river.otter@example.org", firstName: null, lastName: null }));
    expect(result.ok && result.viewer.displayName).toBe("river.otter");
  });

  it("links an invited account by verified email and keeps its existing role", async () => {
    const [invited] = await t.db
      .insert(users)
      .values({ email: "Invited.Guide@Example.org", displayName: "Invited guide", role: "staff" })
      .returning();
    const result = await provisionViewer(t.db, identity({ email: "invited.guide@example.org" }));
    expect(result.ok && result.viewer.userId).toBe(invited.id);
    expect(result.ok && result.viewer.role).toBe("staff");
  });

  it("refuses to attach a second sign-in identity to an already-linked account", async () => {
    // The seeded admin already has a (placeholder) Clerk identity.
    const result = await provisionViewer(t.db, identity({ email: SEEDED.admin }));
    expect(result).toMatchObject({ ok: false, code: "identity-conflict" });
    const admin = await viewerByEmail(t.db, SEEDED.admin);
    const links = await t.db.select().from(authIdentities).where(eq(authIdentities.userId, admin.userId));
    expect(links).toHaveLength(1);
  });

  it("profile sync updates name and email but never the role", async () => {
    const person = identity();
    const created = await provisionViewer(t.db, person);
    if (!created.ok) throw new Error("setup");
    await syncIdentityProfile(t.db, { ...person, email: "renamed@example.org", firstName: "Augusta" });
    const viewer = await findViewer(t.db, person);
    expect(viewer).toMatchObject({ email: "renamed@example.org", displayName: "Augusta Byron", role: "guest" });
  });

  it("unlinking removes sign-in but keeps the account", async () => {
    const person = identity();
    const created = await provisionViewer(t.db, person);
    if (!created.ok) throw new Error("setup");
    expect(await unlinkIdentity(t.db, person)).toBe(true);
    expect(await findViewer(t.db, person)).toBeNull();
    const [user] = await t.db.select().from(users).where(eq(users.id, created.viewer.userId));
    expect(user).toBeDefined();
  });
});

describe("role changes", () => {
  it("guests and staff can't list users or change roles, including their own", async () => {
    const guest = await viewerByEmail(t.db, SEEDED.guest);
    const staff = await viewerByEmail(t.db, SEEDED.staff);
    for (const actor of [guest, staff]) {
      await expect(listUsers(t.db, actor)).rejects.toBeInstanceOf(AuthorizationError);
      await expect(changeUserRole(t.db, actor, { userId: actor.userId, role: "admin" })).rejects.toBeInstanceOf(
        AuthorizationError,
      );
    }
    expect((await viewerByEmail(t.db, SEEDED.guest)).role).toBe("guest");
  });

  it("re-reads the actor's role from the database instead of trusting the session", async () => {
    const guest = await viewerByEmail(t.db, SEEDED.guest);
    const target = await viewerByEmail(t.db, "m.okafor@example.com");
    const forged = { ...guest, role: "admin" as const };
    await expect(changeUserRole(t.db, forged, { userId: target.userId, role: "staff" })).rejects.toBeInstanceOf(
      AuthorizationError,
    );
    expect((await viewerByEmail(t.db, "m.okafor@example.com")).role).toBe("guest");
  });

  it("administrators can't change their own role", async () => {
    const admin = await viewerByEmail(t.db, SEEDED.admin);
    const result = await changeUserRole(t.db, admin, { userId: admin.userId, role: "guest" });
    expect(result).toMatchObject({ ok: false, code: "self-change" });
  });

  it("promoting to staff creates an active staff record; demoting deactivates it", async () => {
    const admin = await viewerByEmail(t.db, SEEDED.admin);
    const target = await viewerByEmail(t.db, "j.lindqvist@example.com");

    expect(await changeUserRole(t.db, admin, { userId: target.userId, role: "staff" })).toMatchObject({ ok: true });
    const promoted = await viewerByEmail(t.db, "j.lindqvist@example.com");
    expect(promoted.role).toBe("staff");
    expect(promoted.staffId).not.toBeNull();

    expect(await changeUserRole(t.db, admin, { userId: target.userId, role: "guest" })).toMatchObject({ ok: true });
    const demoted = await viewerByEmail(t.db, "j.lindqvist@example.com");
    expect(demoted).toMatchObject({ role: "guest", staffId: null });
    const [record] = await t.db.select().from(staffMembers).where(eq(staffMembers.userId, target.userId));
    expect(record.isActive).toBe(false);
  });

  it("reports unknown users", async () => {
    const admin = await viewerByEmail(t.db, SEEDED.admin);
    const result = await changeUserRole(t.db, admin, { userId: "6f1c1d1e-8a0b-4c4e-9d55-3c5d3f2b1a10", role: "staff" });
    expect(result).toMatchObject({ ok: false, code: "not-found" });
  });

  it("the operator bootstrap grants a role by email (case-insensitive)", async () => {
    const target = await setRoleByEmail(t.db, "R.TANAKA@example.com", "admin");
    expect(target?.email).toBe("r.tanaka@example.com");
    expect((await viewerByEmail(t.db, "r.tanaka@example.com")).role).toBe("admin");
    expect(await setRoleByEmail(t.db, "nobody@example.com", "admin")).toBeNull();
  });
});
