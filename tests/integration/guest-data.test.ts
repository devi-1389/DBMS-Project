import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getBookingForViewer, listGuestBookings } from "@/lib/dal/bookings";
import { findSlotId, listCatalogue } from "@/lib/dal/catalogue";
import { AuthorizationError } from "@/lib/dal/errors";
import { addItem, createPlan, deletePlan, getPlan, listPlans, removeItem, updateItemPartySize, updatePlan } from "@/lib/dal/itinerary";
import { getPreferences, savePreferences } from "@/lib/dal/preferences";
import { getStaffSchedule } from "@/lib/dal/staff";
import { bookings, experiences, experienceSlots } from "@/lib/db/schema";
import { resortDayWindow, toDateKey } from "@/lib/format";
import { defaultFilters, filterWindow } from "@/lib/matching/filters";
import { recommendExperiences } from "@/lib/matching/recommend";
import { at, BEFORE_SEASON, createTestDb, SEEDED, viewerByEmail, type TestDb } from "@/tests/support/db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(() => t.close());

const guest = () => viewerByEmail(t.db, SEEDED.guest);
const otherGuest = () => viewerByEmail(t.db, "m.okafor@example.com");

async function slotId(slug: string, startsAt: string) {
  const id = await findSlotId(t.db, slug, new Date(startsAt));
  if (!id) throw new Error(`No slot ${slug} ${startsAt}`);
  return id;
}

async function seatsBooked(id: string) {
  const [row] = await t.db.select({ seats: experienceSlots.seatsBooked }).from(experienceSlots).where(eq(experienceSlots.id, id));
  return row.seats;
}

describe("preferences", () => {
  it("reads the seeded preferences with weights", async () => {
    const preferences = await getPreferences(t.db, (await guest()).userId);
    expect(preferences).toMatchObject({
      interests: expect.arrayContaining(["wildlife", "water", "mindfulness"]),
      interestWeights: { wildlife: 5, water: 4, mindfulness: 3 },
      pace: "easy",
      budgetMaxMinor: 300_000,
      groupSize: 2,
      timesOfDay: ["morning"],
    });
  });

  it("round-trips a full save, replacing interests and times", async () => {
    const { userId } = await otherGuest();
    expect(await getPreferences(t.db, userId)).toBeNull();
    const saved = await savePreferences(t.db, userId, {
      interests: ["mountains", "thrills"],
      categories: ["adventure", "nature"],
      interestWeights: { thrills: 5 },
      pace: "challenging",
      budgetMaxMinor: null,
      groupSize: 4,
      timesOfDay: ["morning", "evening"],
      needsAccessibility: false,
      notes: "Training for a marathon",
    });
    expect(saved).toMatchObject({
      interestWeights: { mountains: 3, thrills: 5 },
      categories: ["nature", "adventure"],
      budgetMaxMinor: null,
      groupSize: 4,
    });

    await savePreferences(t.db, userId, { ...saved, interests: ["food"], categories: [], interestWeights: {}, timesOfDay: [] });
    const reloaded = await getPreferences(t.db, userId);
    expect(reloaded).toMatchObject({ interests: ["food"], categories: [], interestWeights: { food: 3 }, timesOfDay: [] });
  });
});

describe("itinerary plans", () => {
  it("lists only the owner's plans and hides other guests' plans", async () => {
    const owner = await guest();
    const [plan] = await listPlans(t.db, owner.userId);
    expect(plan).toMatchObject({ name: "November stay", arrival: "2026-11-02", departure: "2026-11-05", itemCount: 3 });

    const intruder = await otherGuest();
    expect(await getPlan(t.db, intruder.userId, plan.id)).toBeNull();
    expect(await updatePlan(t.db, intruder.userId, plan.id, { name: "Mine now", arrival: null, departure: null, activityBudgetMinor: null })).toMatchObject({
      ok: false,
      code: "plan-not-found",
    });
    expect(await deletePlan(t.db, intruder.userId, plan.id)).toMatchObject({ ok: false, code: "plan-not-found" });
    const item = (await getPlan(t.db, owner.userId, plan.id))!.items[0];
    expect(await removeItem(t.db, intruder.userId, item.id)).toMatchObject({ ok: false, code: "item-not-found" });
    expect(await updateItemPartySize(t.db, intruder.userId, { itemId: item.id, partySize: 1 })).toMatchObject({
      ok: false,
      code: "item-not-found",
    });
    expect(
      await addItem(t.db, intruder.userId, { planId: plan.id, slotId: item.slotId, partySize: 1 }, BEFORE_SEASON),
    ).toMatchObject({ ok: false, code: "plan-not-found" });
    expect((await getPlan(t.db, owner.userId, plan.id))!.items).toHaveLength(3);
  });

  it("adds sessions without touching seats, and keeps plans separate from bookings", async () => {
    const { userId } = await otherGuest();
    const created = await createPlan(t.db, userId, { name: "Long weekend", arrival: "2026-11-06", departure: "2026-11-09", activityBudgetMinor: null });
    if (!created.ok) throw new Error(created.message);
    const id = await slotId("reforestation-morning", at("2026-11-07", "08:30"));
    const before = await seatsBooked(id);
    const bookingsBefore = await t.db.select({ id: bookings.id }).from(bookings).where(eq(bookings.guestId, userId));

    const added = await addItem(t.db, userId, { planId: created.value.planId, slotId: id, partySize: 2 }, BEFORE_SEASON);
    expect(added).toMatchObject({ ok: true });
    expect(added.ok && added.message).toMatch(/This is a plan, not a booking\./);
    expect(await seatsBooked(id)).toBe(before);
    expect(await t.db.select({ id: bookings.id }).from(bookings).where(eq(bookings.guestId, userId))).toEqual(bookingsBefore);

    // Adding the same session again updates the party size instead of duplicating it.
    const again = await addItem(t.db, userId, { planId: created.value.planId, slotId: id, partySize: 3 }, BEFORE_SEASON);
    expect(again.ok && again.message).toMatch(/^Updated/);
    const plan = await getPlan(t.db, userId, created.value.planId);
    expect(plan?.items.map((item) => item.partySize)).toEqual([3]);
  });

  it("explains why a session can't be planned", async () => {
    const { userId } = await otherGuest();
    const created = await createPlan(t.db, userId, { name: "Checks", arrival: "2026-11-02", departure: "2026-11-04", activityBudgetMinor: null });
    if (!created.ok) throw new Error(created.message);
    const planId = created.value.planId;
    const yoga = await slotId("lakeside-sunrise-yoga", at("2026-11-03", "07:00"));

    const [cancelled] = await t.db
      .select({ id: experienceSlots.id })
      .from(experienceSlots)
      .where(eq(experienceSlots.status, "cancelled"))
      .limit(1);
    expect(await addItem(t.db, userId, { planId, slotId: cancelled.id, partySize: 1 }, BEFORE_SEASON)).toMatchObject({
      ok: false,
      code: "slot-unavailable",
      message: expect.stringMatching(/cancelled: /),
    });
    expect(await addItem(t.db, userId, { planId, slotId: yoga, partySize: 1 }, new Date(at("2026-11-03", "07:00")))).toMatchObject({
      ok: false,
      code: "slot-in-past",
    });
    expect(await addItem(t.db, userId, { planId, slotId: yoga, partySize: 19 }, BEFORE_SEASON)).toMatchObject({
      ok: false,
      code: "party-too-large",
      field: "partySize",
    });
    const late = await slotId("lakeside-sunrise-yoga", at("2026-11-10", "07:00"));
    expect(await addItem(t.db, userId, { planId, slotId: late, partySize: 1 }, BEFORE_SEASON)).toMatchObject({
      ok: false,
      code: "outside-stay",
      message: expect.stringMatching(/outside your stay/),
    });
    expect(
      await addItem(t.db, userId, { planId, slotId: "6f1c1d1e-8a0b-4c4e-9d55-3c5d3f2b1a10", partySize: 1 }, BEFORE_SEASON),
    ).toMatchObject({ ok: false, code: "slot-not-found" });
  });

  it("refuses more guests than seats left, without holding any", async () => {
    const { userId } = await otherGuest();
    const id = await slotId("canopy-zipline-circuit", at("2026-11-04", "10:00"));
    const [slot] = await t.db
      .select({ capacity: experienceSlots.capacity, seats: experienceSlots.seatsBooked, max: experiences.maxGroupSize })
      .from(experienceSlots)
      .innerJoin(experiences, eq(experiences.id, experienceSlots.experienceId))
      .where(eq(experienceSlots.id, id));
    // Make the session nearly full, then ask for more than remain.
    await t.db.update(experienceSlots).set({ seatsBooked: slot.capacity - 1 }).where(and(eq(experienceSlots.id, id)));
    const result = await addItem(t.db, userId, { slotId: id, partySize: Math.min(2, slot.max) }, BEFORE_SEASON);
    expect(result).toMatchObject({ ok: false, code: "not-enough-seats", message: expect.stringMatching(/Plans don't hold seats/) });
    expect(await seatsBooked(id)).toBe(slot.capacity - 1);
  });

  it("warns about overlaps but still saves the plan item", async () => {
    const { userId } = await otherGuest();
    const created = await createPlan(t.db, userId, { name: "Overlap", arrival: null, departure: null, activityBudgetMinor: null });
    if (!created.ok) throw new Error(created.message);
    const planId = created.value.planId;
    const ridge = await slotId("ridge-line-summit-trek", at("2026-11-03", "07:00"));
    const yoga = await slotId("lakeside-sunrise-yoga", at("2026-11-03", "07:00"));
    await addItem(t.db, userId, { planId, slotId: ridge, partySize: 1 }, BEFORE_SEASON);
    const second = await addItem(t.db, userId, { planId, slotId: yoga, partySize: 1 }, BEFORE_SEASON);
    expect(second.ok && second.message).toMatch(/overlaps with Ridge/i);
    expect((await getPlan(t.db, userId, planId))?.items).toHaveLength(2);
  });
});

describe("booking ownership", () => {
  it("guests see only their own bookings", async () => {
    const owner = await guest();
    const mine = await listGuestBookings(t.db, owner.userId);
    expect(mine.map((booking) => booking.reference).sort()).toEqual(["LX-2MW9", "LX-4KQ7", "LX-6RJ3", "LX-8TB2", "LX-9PD5"]);
    expect(await getBookingForViewer(t.db, owner, "LX-4KQ7")).toMatchObject({ reference: "LX-4KQ7", ownedByViewer: true });
    expect(await getBookingForViewer(t.db, owner, "LX-3HV8")).toBeNull();
    expect(await getBookingForViewer(t.db, owner, "LX-NOPE")).toBeNull();
  });

  it("staff see bookings on sessions they're assigned to, and nothing else", async () => {
    const staff = await viewerByEmail(t.db, SEEDED.staff); // Mara leads the river canoe
    expect(await getBookingForViewer(t.db, staff, "LX-7CN1")).toMatchObject({ ownedByViewer: false });
    expect(await getBookingForViewer(t.db, staff, "LX-3HV8")).toBeNull();
  });

  it("administrators see any booking", async () => {
    const admin = await viewerByEmail(t.db, SEEDED.admin);
    expect(await getBookingForViewer(t.db, admin, "LX-3HV8")).toMatchObject({ reference: "LX-3HV8" });
  });
});

describe("staff schedule", () => {
  const window = resortDayWindow("2026-11-01", "2026-11-15");

  it("lists only the staff member's own assignments", async () => {
    const staff = await viewerByEmail(t.db, SEEDED.staff);
    const sessions = await getStaffSchedule(t.db, staff, window);
    expect(sessions.length).toBeGreaterThan(0);
    expect(new Set(sessions.map((session) => session.staffName))).toEqual(new Set(["Mara Ellis"]));
    const canoe = sessions.find((session) => session.startsAt === at("2026-11-04", "06:30"));
    expect(canoe?.manifest).toEqual([{ reference: "LX-7CN1", guest: "J. L.", partySize: 2, status: "confirmed" }]);
  });

  it("administrators see every assignment; guests are refused", async () => {
    const admin = await viewerByEmail(t.db, SEEDED.admin);
    const all = await getStaffSchedule(t.db, admin, window);
    expect(new Set(all.map((session) => session.staffName)).size).toBeGreaterThan(1);
    await expect(getStaffSchedule(t.db, await guest(), window)).rejects.toBeInstanceOf(AuthorizationError);
  });
});

describe("recommendations from database records", () => {
  it("ranks published, scheduled sessions using the guest's stored preferences", async () => {
    const owner = await guest();
    const preferences = (await getPreferences(t.db, owner.userId))!;
    const plan = await getPlan(t.db, owner.userId, (await listPlans(t.db, owner.userId))[0].id);
    const filters = defaultFilters(preferences, plan, BEFORE_SEASON);
    expect(filters).toMatchObject({ from: "2026-11-02", to: "2026-11-05", partySize: 2, maxPricePerGuestMinor: 300_000 });

    const catalogue = await listCatalogue(t.db, filterWindow(filters));
    expect(catalogue.slots.every((slot) => toDateKey(slot.startsAt) >= "2026-11-02" && toDateKey(slot.startsAt) <= "2026-11-05")).toBe(true);

    const { recommendations, excluded } = recommendExperiences({
      ...catalogue,
      preferences,
      filters,
      planned: plan!.items,
      now: BEFORE_SEASON,
    });
    expect(recommendations.length).toBeGreaterThan(0);
    for (const match of recommendations) {
      expect(match.experience.difficulty).toBe("easy");
      expect(match.experience.priceFromMinor).toBeLessThanOrEqual(300_000);
      expect(match.score).toBe(match.factors.reduce((sum, factor) => sum + factor.points, 0));
      // Sessions already in the plan aren't suggested again.
      expect(match.sessions.some((slot) => plan!.items.some((item) => item.slotId === slot.id))).toBe(false);
    }
    expect(excluded["too-challenging"]).toBeGreaterThan(0);
  });
});
