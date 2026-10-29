// End-to-end checks of the server entry points (Server Actions, page guards and the
// Clerk webhook) with Clerk's session mocked and a real database underneath.
import { createHmac, randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { ClerkSession } from "@/lib/auth/clerk";
import type { VerifiedIdentity } from "@/lib/auth/types";
import type { Db } from "@/lib/db/types";
import { authIdentities, users } from "@/lib/db/schema";
import { at, BEFORE_SEASON, createTestDb, SEEDED, viewerByEmail, type TestDb } from "@/tests/support/db";

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  session: { status: "signed-out" } as { status: "signed-out" } | { status: "signed-in"; providerUserId: string },
  identity: null as unknown,
}));

vi.mock("@/lib/db", () => ({ getDb: () => state.db }));
vi.mock("@/lib/auth/clerk", () => ({
  getClerkSession: async (): Promise<ClerkSession> => state.session,
  getVerifiedClerkIdentity: async () => state.identity as VerifiedIdentity | null,
}));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));

const { changeUserRoleAction } = await import("@/app/actions/admin");
const { addSessionToPlanAction } = await import("@/app/actions/itinerary");
const { savePreferencesAction } = await import("@/app/actions/preferences");
const { POST: clerkWebhook } = await import("@/app/api/webhooks/clerk/route");
const { checkPageAccess } = await import("@/lib/auth/guards");
const { getPreferences } = await import("@/lib/dal/preferences");

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
  state.db = t.db;
});
afterAll(() => t.close());

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_dGVzdC5jbGVyay5hY2NvdW50cy5kZXYk");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_testsecret");
  vi.stubEnv("DATABASE_URL", "postgres://test");
  state.session = { status: "signed-out" };
  state.identity = null;
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

const preferences = {
  interests: ["forest"],
  interestWeights: {},
  pace: "easy",
  budgetMaxMinor: null,
  groupSize: 2,
  timesOfDay: [],
  needsAccessibility: false,
  notes: "",
};

async function signInAs(email: string) {
  const [row] = await (t.db as Db)
    .select({ providerUserId: authIdentities.providerUserId })
    .from(authIdentities)
    .innerJoin(users, eq(users.id, authIdentities.userId))
    .where(eq(users.email, email));
  state.session = { status: "signed-in", providerUserId: row.providerUserId };
}

describe("without credentials", () => {
  it("fails closed when Clerk isn't configured", async () => {
    vi.stubEnv("CLERK_SECRET_KEY", "");
    await signInAs(SEEDED.admin); // even a session that looks valid is ignored
    expect(await savePreferencesAction(preferences)).toMatchObject({ ok: false, code: "auth-unconfigured" });
    expect(await checkPageAccess("admin")).toMatchObject({ kind: "unavailable", state: { status: "auth-unconfigured" } });
  });

  it("asks signed-out visitors to sign in", async () => {
    expect(await savePreferencesAction(preferences)).toMatchObject({ ok: false, code: "unauthenticated" });
    expect(await checkPageAccess("guest")).toEqual({ kind: "sign-in" });
  });
});

describe("first sign-in", () => {
  it("won't create an account until the email is verified", async () => {
    state.session = { status: "signed-in", providerUserId: "user_unverified" };
    state.identity = null;
    expect(await checkPageAccess("guest")).toMatchObject({ kind: "unavailable", state: { status: "unverified-email" } });
  });

  it("provisions a guest who can't reach staff or admin areas", async () => {
    state.session = { status: "signed-in", providerUserId: "user_newcomer" };
    state.identity = {
      provider: "clerk",
      providerUserId: "user_newcomer",
      email: "newcomer@example.org",
      firstName: "New",
      lastName: "Comer",
    } satisfies VerifiedIdentity;
    expect(await checkPageAccess("guest")).toMatchObject({ kind: "allowed", viewer: { role: "guest" } });
    expect(await checkPageAccess("staff")).toMatchObject({ kind: "forbidden" });
    expect(await checkPageAccess("admin")).toMatchObject({ kind: "forbidden" });
  });
});

describe("guests can't escalate", () => {
  it("can't change their own role", async () => {
    await signInAs(SEEDED.guest);
    const me = await viewerByEmail(t.db as Db, SEEDED.guest);
    expect(await changeUserRoleAction({ userId: me.userId, role: "admin" })).toMatchObject({ ok: false, code: "forbidden" });
    expect((await viewerByEmail(t.db as Db, SEEDED.guest)).role).toBe("guest");
  });

  it("can't smuggle a role into another form", async () => {
    await signInAs(SEEDED.guest);
    const result = await savePreferencesAction({ ...preferences, role: "admin" });
    expect(result).toMatchObject({ ok: false, code: "invalid", message: expect.stringMatching(/unrecognized key/i) });
    expect((await viewerByEmail(t.db as Db, SEEDED.guest)).role).toBe("guest");
  });

  it("can't pick another guest's account through the input", async () => {
    await signInAs(SEEDED.guest);
    const other = await viewerByEmail(t.db as Db, "a.moreau@example.com");
    expect(await savePreferencesAction({ ...preferences, guestId: other.userId })).toMatchObject({ code: "invalid" });
    expect(await getPreferences(t.db as Db, other.userId)).toBeNull();
  });
});

describe("guest actions", () => {
  it("saves preferences to the signed-in guest's account", async () => {
    await signInAs("a.moreau@example.com");
    const result = await savePreferencesAction({ ...preferences, budgetMaxMinor: 12_000 });
    expect(result).toMatchObject({ ok: true, message: "Preferences saved to your account." });
    const me = await viewerByEmail(t.db as Db, "a.moreau@example.com");
    expect(await getPreferences(t.db as Db, me.userId)).toMatchObject({ interests: ["forest"], budgetMaxMinor: 12_000 });
  });

  it("returns field errors for invalid input", async () => {
    await signInAs("a.moreau@example.com");
    const result = await savePreferencesAction({ ...preferences, interests: [], groupSize: 0 });
    expect(result).toMatchObject({
      ok: false,
      code: "invalid",
      fieldErrors: { interests: "Choose at least one interest.", groupSize: expect.stringMatching(/at least 1/) },
    });
  });

  it("adds a session from an experience page to the guest's plan", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: BEFORE_SEASON });
    await signInAs("a.moreau@example.com");
    const input = { experienceSlug: "lakeside-sunrise-yoga", startsAt: at("2026-11-03", "07:00"), partySize: 2 };
    expect(await addSessionToPlanAction(input)).toMatchObject({ ok: true, message: expect.stringMatching(/My stay/) });
    expect(await addSessionToPlanAction({ ...input, startsAt: at("2026-11-03", "07:05") })).toMatchObject({
      ok: false,
      code: "slot-not-found",
    });
  });
});

describe("administrators", () => {
  it("can change another user's role through the action", async () => {
    await signInAs(SEEDED.admin);
    const target = await viewerByEmail(t.db as Db, "s.haddad@example.com");
    expect(await changeUserRoleAction({ userId: target.userId, role: "staff" })).toMatchObject({ ok: true });
    expect((await viewerByEmail(t.db as Db, "s.haddad@example.com")).role).toBe("staff");
    expect(await changeUserRoleAction({ userId: target.userId, role: "owner" })).toMatchObject({ code: "invalid" });
  });

  it("staff reach the staff area but not the admin area", async () => {
    await signInAs(SEEDED.staff);
    expect(await checkPageAccess("staff")).toMatchObject({ kind: "allowed" });
    expect(await checkPageAccess("admin")).toMatchObject({ kind: "forbidden" });
  });
});

describe("Clerk webhook", () => {
  const secretBytes = randomBytes(24);
  const secret = `whsec_${secretBytes.toString("base64")}`;

  function signed(payload: object, { sign = true } = {}) {
    const body = JSON.stringify(payload);
    const id = `msg_${randomBytes(6).toString("hex")}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac("sha256", secretBytes).update(`${id}.${timestamp}.${body}`).digest("base64");
    return new Request("http://localhost/api/webhooks/clerk", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "svix-id": id,
        "svix-timestamp": timestamp,
        "svix-signature": `v1,${sign ? signature : "bm90IHRoZSByaWdodCBzaWduYXR1cmU="}`,
      },
      body,
    });
  }

  const userCreated = (id: string, email: string, status = "verified") => ({
    type: "user.created",
    object: "event",
    data: {
      id,
      object: "user",
      first_name: "Hook",
      last_name: "Guest",
      primary_email_address_id: "idn_1",
      email_addresses: [{ id: "idn_1", email_address: email, verification: { status } }],
      // A client can write unsafe metadata; it must never become a role.
      unsafe_metadata: { role: "admin" },
      public_metadata: { role: "admin" },
    },
  });

  it("is disabled without a signing secret", async () => {
    const response = await clerkWebhook(signed(userCreated("user_hook0", "hook0@example.org")) as never);
    expect(response.status).toBe(503);
  });

  it("rejects requests with a bad signature", async () => {
    vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", secret);
    const response = await clerkWebhook(signed(userCreated("user_hook1", "hook1@example.org"), { sign: false }) as never);
    expect(response.status).toBe(400);
    const [row] = await (t.db as Db).select().from(users).where(eq(users.email, "hook1@example.org"));
    expect(row).toBeUndefined();
  });

  it("provisions verified users as guests, ignoring metadata roles", async () => {
    vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", secret);
    const response = await clerkWebhook(signed(userCreated("user_hook2", "hook2@example.org")) as never);
    expect(response.status).toBe(200);
    const [row] = await (t.db as Db).select().from(users).where(eq(users.email, "hook2@example.org"));
    expect(row?.role).toBe("guest");
  });

  it("skips unverified emails", async () => {
    vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", secret);
    const response = await clerkWebhook(signed(userCreated("user_hook3", "hook3@example.org", "unverified")) as never);
    expect(response.status).toBe(200);
    const [row] = await (t.db as Db).select().from(users).where(eq(users.email, "hook3@example.org"));
    expect(row).toBeUndefined();
  });
});
