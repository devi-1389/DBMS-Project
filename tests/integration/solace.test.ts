// The SOLACE / LUXE-ECO flow on real database records: preferences → matching →
// resource availability (guides, venues, shared equipment) → a day-by-day plan within an
// activity budget. Plans never hold seats or equipment.
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { findSlotId, listCatalogue } from "@/lib/dal/catalogue";
import { provisionViewer } from "@/lib/dal/identity";
import { addItem, createPlan, getPlan } from "@/lib/dal/itinerary";
import { suggestDaysForPlan } from "@/lib/dal/planner";
import { savePreferences } from "@/lib/dal/preferences";
import { experiences, experienceSlots, resourceAllocations, resources, staffAssignments } from "@/lib/db/schema";
import { resortDayWindow, timeOfDay, toDateKey } from "@/lib/format";
import { overlaps } from "@/lib/itinerary";
import { at, BEFORE_SEASON, createTestDb, type TestDb } from "@/tests/support/db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(() => t.close());

async function slotId(slug: string, startsAt: string) {
  const id = await findSlotId(t.db, slug, new Date(startsAt));
  if (!id) throw new Error(`No slot ${slug} ${startsAt}`);
  return id;
}

async function newGuest(email: string) {
  const result = await provisionViewer(t.db, {
    provider: "clerk",
    providerUserId: `user_${email}`,
    email,
    firstName: "Asha",
    lastName: "Verma",
  });
  if (!result.ok) throw new Error(result.message);
  return result.viewer;
}

describe("session readiness from the database", () => {
  it("names who leads each session and which resources are held", async () => {
    const { slots } = await listCatalogue(t.db, resortDayWindow("2026-11-04", "2026-11-04"));
    const canoe = slots.find((slot) => slot.experienceSlug === "river-wildlife-canoe")!;
    expect(canoe.readiness).toMatchObject({
      ready: true,
      staff: ["Mara Ellis"],
      resources: ["Two-person canoe", "Wildlife binoculars"],
      missing: [],
    });
  });

  it("caps places when a shared equipment pool is short (kayaks out for repairs)", async () => {
    // 10 kayaks, 4 out for rudder replacement on 9 Nov, 3 held by booking LX-4KY8.
    const { slots } = await listCatalogue(t.db, resortDayWindow("2026-11-09", "2026-11-09"));
    const kayaks = slots.filter((slot) => slot.experienceSlug === "lake-kayak-expedition");
    expect(kayaks.map((slot) => [slot.capacity - slot.booked, slot.readiness?.bookableSeats, slot.readiness?.limitedBy])).toEqual([
      [5, 3, "Single kayak"],
      [8, 6, "Single kayak"],
    ]);
  });

  it("refuses to plan more guests than the shared equipment can take", async () => {
    const guest = await newGuest("kayak.guest@example.org");
    const morning = await slotId("lake-kayak-expedition", at("2026-11-09", "07:30"));
    expect(await addItem(t.db, guest.userId, { slotId: morning, partySize: 4 }, BEFORE_SEASON)).toMatchObject({
      ok: false,
      code: "not-enough-equipment",
      message: expect.stringMatching(/Only 3 places left: the shared Single kayak pool/),
    });
    expect(await addItem(t.db, guest.userId, { slotId: morning, partySize: 3 }, BEFORE_SEASON)).toMatchObject({ ok: true });
  });

  it("refuses sessions with no guide, or without their venue or vehicle", async () => {
    const guest = await newGuest("ready.guest@example.org");

    const yoga = await slotId("lakeside-sunrise-yoga", at("2026-11-06", "07:00"));
    await t.db.update(staffAssignments).set({ status: "released" }).where(eq(staffAssignments.slotId, yoga));
    expect(await addItem(t.db, guest.userId, { slotId: yoga, partySize: 1 }, BEFORE_SEASON)).toMatchObject({
      ok: false,
      code: "slot-not-ready",
      message: expect.stringMatching(/no guide or host is assigned/),
    });

    const trail = await slotId("inlet-food-trail", at("2026-11-06", "11:30"));
    const [van] = await t.db.select({ id: resources.id }).from(resources).where(eq(resources.name, "Electric shuttle van"));
    await t.db
      .update(resourceAllocations)
      .set({ status: "released" })
      .where(and(eq(resourceAllocations.slotId, trail), eq(resourceAllocations.resourceId, van.id)));
    expect(await addItem(t.db, guest.userId, { slotId: trail, partySize: 1 }, BEFORE_SEASON)).toMatchObject({
      ok: false,
      code: "slot-not-ready",
      message: expect.stringMatching(/Electric shuttle van isn't available/),
    });
  });
});

describe("the brief's example stay", () => {
  // "A guest staying for 3 days likes nature + adventure + luxury, has a ₹15,000 activity
  // budget, and prefers morning activities."
  it("plans three days within ₹15,000 using only sessions that can run", async () => {
    const guest = await newGuest("brief.guest@example.org");
    const preferences = await savePreferences(t.db, guest.userId, {
      interests: ["wildlife", "water", "forest", "thrills", "food"],
      categories: ["nature", "adventure", "luxury"],
      interestWeights: {},
      pace: "moderate",
      budgetMaxMinor: null,
      groupSize: 1,
      timesOfDay: ["morning"],
      needsAccessibility: false,
      notes: "",
    });
    const created = await createPlan(t.db, guest.userId, {
      name: "Three days at SOLACE",
      arrival: "2026-11-03",
      departure: "2026-11-05",
      activityBudgetMinor: 1_500_000,
    });
    if (!created.ok) throw new Error(created.message);
    const plan = (await getPlan(t.db, guest.userId, created.value.planId))!;
    expect(plan.activityBudgetMinor).toBe(1_500_000);

    const suggestion = (await suggestDaysForPlan(t.db, plan, preferences, BEFORE_SEASON))!;
    const days = suggestion.sessions.map((item) => toDateKey(item.slot.startsAt));
    const categories = new Set(suggestion.sessions.map((item) => item.recommendation.experience.category));

    expect([...new Set(days)].sort()).toEqual(["2026-11-03", "2026-11-04", "2026-11-05"]);
    expect(suggestion.totalMinor).toBeLessThanOrEqual(1_500_000);
    expect(suggestion.remainingMinor).toBe(1_500_000 - suggestion.totalMinor);
    for (const category of ["nature", "adventure", "luxury"] as const) expect(categories.has(category)).toBe(true);
    for (const day of ["2026-11-03", "2026-11-04", "2026-11-05"]) {
      const sessions = suggestion.sessions.filter((item) => toDateKey(item.slot.startsAt) === day);
      expect(sessions.length).toBeLessThanOrEqual(2);
      expect(sessions.some((item) => timeOfDay(item.slot.startsAt) === "morning")).toBe(true);
    }
    for (const [i, a] of suggestion.sessions.entries()) {
      expect(a.slot.readiness?.ready).toBe(true);
      for (const b of suggestion.sessions.slice(i + 1)) expect(overlaps(a.slot, b.slot)).toBe(false);
    }

    // Adding the suggestions to the plan changes no seat counts.
    const before = await t.db.select({ id: experienceSlots.id, seats: experienceSlots.seatsBooked }).from(experienceSlots);
    for (const item of suggestion.sessions) {
      expect(await addItem(t.db, guest.userId, { planId: plan.id, slotId: item.slot.id, partySize: 1 }, BEFORE_SEASON)).toMatchObject({
        ok: true,
      });
    }
    const after = await t.db.select({ id: experienceSlots.id, seats: experienceSlots.seatsBooked }).from(experienceSlots);
    expect(after).toEqual(before);

    // With the plan full of matches, the remaining budget is what the planner works from.
    const planned = (await getPlan(t.db, guest.userId, plan.id))!;
    const next = (await suggestDaysForPlan(t.db, planned, preferences, BEFORE_SEASON))!;
    expect(next.totalMinor).toBeLessThanOrEqual(1_500_000 - suggestion.totalMinor);
  });

  it("names the brief's experiences in the catalogue", async () => {
    const rows = await t.db.select({ slug: experiences.slug }).from(experiences);
    expect(rows.map((row) => row.slug)).toEqual(
      expect.arrayContaining([
        "signature-spa-ritual",
        "canopy-sunset-dining",
        "lake-kayak-expedition",
        "inlet-food-trail",
        "old-growth-forest-trail",
        "heritage-village-walk",
        "valley-cycle-trail",
        "lakeside-cabana",
      ]),
    );
  });
});
