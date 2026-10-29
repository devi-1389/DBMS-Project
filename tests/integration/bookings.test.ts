// Phase 6 booking writes on real migrations and seed data: seats, equipment, status
// history, idempotency, ownership and the cancellation window.
import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Viewer } from "@/lib/auth/types";
import { cancelBooking, changeBookingGuests, createBooking } from "@/lib/dal/booking-writes";
import { getBookingForViewer, listGuestBookings } from "@/lib/dal/bookings";
import { findSlotId, listExperienceSessions } from "@/lib/dal/catalogue";
import { provisionViewer } from "@/lib/dal/identity";
import { addItem, getPlan } from "@/lib/dal/itinerary";
import { bookings, bookingStatusHistory, experienceSlots, resourceAllocations, resources } from "@/lib/db/schema";
import { resortDayWindow } from "@/lib/format";
import { at, BEFORE_SEASON, createTestDb, SEEDED, viewerByEmail, type TestDb } from "@/tests/support/db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(() => t.close());

let guestCount = 0;
async function newGuest(): Promise<Viewer> {
  guestCount++;
  const result = await provisionViewer(t.db, {
    provider: "clerk",
    providerUserId: `user_booker_${guestCount}`,
    email: `booker${guestCount}@example.org`,
    firstName: "Riya",
    lastName: `Kapoor ${guestCount}`,
  });
  if (!result.ok) throw new Error(result.message);
  return result.viewer;
}

async function slotId(slug: string, day: string, time: string) {
  const id = await findSlotId(t.db, slug, new Date(at(day, time)));
  if (!id) throw new Error(`No slot ${slug} ${day} ${time}`);
  return id;
}

async function seats(id: string) {
  const [row] = await t.db.select({ seats: experienceSlots.seatsBooked }).from(experienceSlots).where(eq(experienceSlots.id, id));
  return row.seats;
}

const book = (viewer: Viewer, slot: string, partySize: number, now = BEFORE_SEASON, idempotencyKey = randomUUID()) =>
  createBooking(t.db, viewer, { slotId: slot, partySize, idempotencyKey }, now);

describe("createBooking", () => {
  it("confirms the booking, holds seats and records who booked it", async () => {
    const guest = await newGuest();
    const yoga = await slotId("lakeside-sunrise-yoga", "2026-11-04", "07:00");
    const before = await seats(yoga);

    const result = await book(guest, yoga, 2);
    expect(result).toMatchObject({ ok: true, value: { created: true } });
    if (!result.ok) return;
    expect(result.value.reference).toMatch(/^LX-[A-Z0-9]{6}$/);
    expect(result.message).toMatch(/Lakeside Sunrise Yoga.*2 guests.*₹1,800 payable at the resort/);
    expect(await seats(yoga)).toBe(before + 2);

    const [row] = await t.db.select().from(bookings).where(eq(bookings.reference, result.value.reference));
    expect(row).toMatchObject({ status: "confirmed", partySize: 2, unitPrice: "900.00", totalAmount: "1800.00", currency: "INR" });
    const history = await t.db.select().from(bookingStatusHistory).where(eq(bookingStatusHistory.bookingId, row.id));
    expect(history).toMatchObject([
      { fromStatus: null, toStatus: "confirmed", changedByUserId: guest.userId, reason: "Booked online (pay at resort)" },
    ]);
    expect((await listGuestBookings(t.db, guest.userId)).map((item) => item.reference)).toEqual([result.value.reference]);
  });

  it("holds shared per-guest equipment and links the guest's plan item", async () => {
    const guest = await newGuest();
    const kayak = await slotId("lake-kayak-expedition", "2026-11-10", "07:30");
    const planned = await addItem(t.db, guest.userId, { slotId: kayak, partySize: 2 }, BEFORE_SEASON);
    if (!planned.ok) throw new Error(planned.message);

    const result = await book(guest, kayak, 2);
    if (!result.ok) throw new Error(result.message);
    const [row] = await t.db.select({ id: bookings.id }).from(bookings).where(eq(bookings.reference, result.value.reference));
    const holds = await t.db
      .select({ resource: resources.name, quantity: resourceAllocations.quantity, status: resourceAllocations.status })
      .from(resourceAllocations)
      .innerJoin(resources, eq(resources.id, resourceAllocations.resourceId))
      .where(eq(resourceAllocations.bookingId, row.id));
    expect(holds).toEqual([{ resource: "Single kayak", quantity: 2, status: "held" }]);

    const plan = await getPlan(t.db, guest.userId, planned.value.planId);
    expect(plan?.items[0].booking).toEqual({ reference: result.value.reference, status: "confirmed" });
  });

  it("is idempotent: a retried request returns the same booking", async () => {
    const guest = await newGuest();
    const trail = await slotId("old-growth-forest-trail", "2026-11-05", "08:00");
    const key = randomUUID();
    const first = await book(guest, trail, 1, BEFORE_SEASON, key);
    const seatsAfterFirst = await seats(trail);
    const retry = await book(guest, trail, 1, BEFORE_SEASON, key);
    expect(first.ok && retry.ok && retry.value).toEqual({ reference: first.ok ? first.value.reference : "", created: false });
    expect(await seats(trail)).toBe(seatsAfterFirst);
    expect(await t.db.select().from(bookings).where(eq(bookings.guestId, guest.userId))).toHaveLength(1);
  });

  it("refuses a second active booking for the same session", async () => {
    const guest = await newGuest();
    const cabana = await slotId("lakeside-cabana", "2026-11-06", "10:00");
    expect(await book(guest, cabana, 2)).toMatchObject({ ok: true });
    expect(await book(guest, cabana, 1)).toMatchObject({ ok: false, code: "already-booked" });
  });

  it("explains every refusal", async () => {
    const guest = await newGuest();
    const kayak = await slotId("lake-kayak-expedition", "2026-11-09", "07:30");
    expect(await book(guest, kayak, 4)).toMatchObject({
      ok: false,
      code: "not-enough-equipment",
      message: expect.stringMatching(/Only 3 places left: the shared Single kayak pool/),
    });
    expect(await book(guest, kayak, 9)).toMatchObject({ ok: false, code: "party-too-large" });

    const dinner = await slotId("canopy-sunset-dining", "2026-11-05", "17:30");
    expect(await book(guest, dinner, 1, new Date(at("2026-11-05", "16:00")))).toMatchObject({ ok: false, code: "booking-closed" });
    expect(await book(guest, dinner, 1, new Date(at("2026-11-05", "18:00")))).toMatchObject({ ok: false, code: "slot-in-past" });

    const spa = await slotId("signature-spa-ritual", "2026-11-07", "10:00");
    await t.db.update(experienceSlots).set({ seatsBooked: 1 }).where(eq(experienceSlots.id, spa));
    expect(await book(guest, spa, 2)).toMatchObject({ ok: false, code: "sold-out", message: "Only 1 seat left for this session." });

    expect(await book(guest, randomUUID(), 1)).toMatchObject({ ok: false, code: "slot-not-found" });
  });

  it("only guest accounts can book", async () => {
    const staff = await viewerByEmail(t.db, SEEDED.staff); // seeded staff account without a guest profile
    const yoga = await slotId("lakeside-sunrise-yoga", "2026-11-04", "07:00");
    expect(await book(staff, yoga, 1)).toMatchObject({ ok: false, code: "no-guest-profile" });
  });
});

describe("cancelBooking", () => {
  it("releases seats and equipment, logs the change and lets the guest rebook", async () => {
    const guest = await newGuest();
    const cycle = await slotId("valley-cycle-trail", "2026-11-08", "06:45");
    const before = await seats(cycle);
    const booked = await book(guest, cycle, 3);
    if (!booked.ok) throw new Error(booked.message);
    expect(await seats(cycle)).toBe(before + 3);

    expect(await cancelBooking(t.db, guest, booked.value.reference, BEFORE_SEASON)).toMatchObject({ ok: true });
    expect(await seats(cycle)).toBe(before);
    const [row] = await t.db.select().from(bookings).where(eq(bookings.reference, booked.value.reference));
    expect(row.status).toBe("cancelled");
    const holds = await t.db.select().from(resourceAllocations).where(eq(resourceAllocations.bookingId, row.id));
    expect(holds.map((hold) => hold.status)).toEqual(["released"]);
    const history = await t.db
      .select({ to: bookingStatusHistory.toStatus, reason: bookingStatusHistory.reason })
      .from(bookingStatusHistory)
      .where(eq(bookingStatusHistory.bookingId, row.id));
    expect(history.at(-1)).toEqual({ to: "cancelled", reason: "Cancelled by the guest" });

    expect(await book(guest, cycle, 1)).toMatchObject({ ok: true });
  });

  it("closes online cancellation 24 hours before the start, except for administrators", async () => {
    const guest = await newGuest();
    const walk = await slotId("heritage-village-walk", "2026-11-10", "09:00");
    const booked = await book(guest, walk, 2);
    if (!booked.ok) throw new Error(booked.message);
    const lateNow = new Date(at("2026-11-09", "12:00")); // 21 hours before
    expect(await cancelBooking(t.db, guest, booked.value.reference, lateNow)).toMatchObject({ ok: false, code: "too-late" });

    const admin = await viewerByEmail(t.db, SEEDED.admin);
    expect(await cancelBooking(t.db, admin, booked.value.reference, lateNow)).toMatchObject({ ok: true });
    const [row] = await t.db.select({ id: bookings.id }).from(bookings).where(eq(bookings.reference, booked.value.reference));
    const [last] = await t.db
      .select({ reason: bookingStatusHistory.reason, by: bookingStatusHistory.changedByUserId })
      .from(bookingStatusHistory)
      .where(and(eq(bookingStatusHistory.bookingId, row.id), eq(bookingStatusHistory.toStatus, "cancelled")));
    expect(last).toEqual({ reason: "Cancelled by an administrator", by: admin.userId });
  });

  it("hides other guests' bookings", async () => {
    const owner = await newGuest();
    const intruder = await newGuest();
    const walk = await slotId("heritage-village-walk", "2026-11-12", "16:00");
    const booked = await book(owner, walk, 1);
    if (!booked.ok) throw new Error(booked.message);
    expect(await cancelBooking(t.db, intruder, booked.value.reference, BEFORE_SEASON)).toMatchObject({ code: "not-found" });
    expect(await changeBookingGuests(t.db, intruder, { reference: booked.value.reference, partySize: 3 }, BEFORE_SEASON)).toMatchObject({
      code: "not-found",
    });
    expect(await cancelBooking(t.db, owner, "LX-NOPE00", BEFORE_SEASON)).toMatchObject({ code: "not-found" });
  });
});

describe("changeBookingGuests", () => {
  it("adjusts seats and equipment both ways", async () => {
    const guest = await newGuest();
    const kayak = await slotId("lake-kayak-expedition", "2026-11-11", "15:30");
    const before = await seats(kayak);
    const booked = await book(guest, kayak, 2);
    if (!booked.ok) throw new Error(booked.message);
    const [row] = await t.db.select({ id: bookings.id }).from(bookings).where(eq(bookings.reference, booked.value.reference));
    const kayaksHeld = async () =>
      (await t.db.select({ quantity: resourceAllocations.quantity }).from(resourceAllocations).where(eq(resourceAllocations.bookingId, row.id)))[0]
        .quantity;

    expect(await changeBookingGuests(t.db, guest, { reference: booked.value.reference, partySize: 4 }, BEFORE_SEASON)).toMatchObject({ ok: true });
    expect(await seats(kayak)).toBe(before + 4);
    expect(await kayaksHeld()).toBe(4);

    expect(await changeBookingGuests(t.db, guest, { reference: booked.value.reference, partySize: 1 }, BEFORE_SEASON)).toMatchObject({ ok: true });
    expect(await seats(kayak)).toBe(before + 1);
    expect(await kayaksHeld()).toBe(1);

    expect(await changeBookingGuests(t.db, guest, { reference: booked.value.reference, partySize: 9 }, BEFORE_SEASON)).toMatchObject({
      code: "party-too-large",
    });
  });

  it("checks shared equipment for the extra guests and the 24-hour window", async () => {
    const guest = await newGuest();
    // 9 Nov 07:30 kayaks: 3 places left after LX-4KY8 and the rudder repairs.
    const kayak = await slotId("lake-kayak-expedition", "2026-11-09", "07:30");
    const booked = await book(guest, kayak, 2);
    if (!booked.ok) throw new Error(booked.message);
    expect(await changeBookingGuests(t.db, guest, { reference: booked.value.reference, partySize: 4 }, BEFORE_SEASON)).toMatchObject({
      code: "not-enough-equipment",
    });
    expect(await changeBookingGuests(t.db, guest, { reference: booked.value.reference, partySize: 3 }, BEFORE_SEASON)).toMatchObject({ ok: true });
    expect(
      await changeBookingGuests(t.db, guest, { reference: booked.value.reference, partySize: 2 }, new Date(at("2026-11-09", "06:00"))),
    ).toMatchObject({ code: "too-late" });
  });
});

describe("live sessions and change limits", () => {
  it("lists one experience's sessions with readiness, and caps guest changes by seats and equipment", async () => {
    const sessions = await listExperienceSessions(t.db, "lake-kayak-expedition", resortDayWindow("2026-11-09", "2026-11-09"));
    expect(sessions.map((slot) => slot.startsAt)).toEqual([at("2026-11-09", "07:30"), at("2026-11-09", "15:30")]);
    const afternoon = sessions[1];
    expect(afternoon.readiness).toMatchObject({ ready: true, bookableSeats: 6, limitedBy: "Single kayak" });

    const guest = await newGuest();
    const booked = await book(guest, afternoon.id, 2);
    if (!booked.ok) throw new Error(booked.message);
    // 8 seats, 6 kayaks free during the repairs: 2 booked, so 4 more kayaks → up to 6 guests.
    expect((await getBookingForViewer(t.db, guest, booked.value.reference))?.maxPartySize).toBe(6);
  });
});

