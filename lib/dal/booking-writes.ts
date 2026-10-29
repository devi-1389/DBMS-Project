import "server-only";

import { randomInt } from "node:crypto";

import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import type { Viewer } from "@/lib/auth/types";
import { BOOKING_POLICY, isActiveBooking, isBookable, isChangeable } from "@/lib/bookings";
import {
  bookings,
  experienceResourceRequirements,
  experiences,
  experienceSlots,
  guestProfiles,
  itineraryItems,
  itineraryPlans,
  resourceAllocations,
  slotReadiness,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { formatAmount, formatDate, formatTime } from "@/lib/format";
import { decimalToMinor } from "@/lib/money";

import { fail, ok, pgConstraint, pgErrorCode, type DalResult } from "./errors";
import { readinessColumns, readinessProblem } from "./readiness";

// Booking writes. Each runs in one transaction (Neon WebSocket driver in the app) and
// takes locks in one order, slot row first and then resource rows, so concurrent
// bookings queue rather than deadlock. Triggers in drizzle/0001_integrity.sql have the
// final say on seats (LXB01), equipment (LXR01) and status changes. The checks here only
// turn the common cases into clear messages before the database would refuse.

const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I

function newReference() {
  return `LX-${Array.from({ length: 6 }, () => REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)]).join("")}`;
}

/** Recorded in booking_status_history by the bookings_log_status trigger. */
async function setActor(tx: Db, userId: string, reason: string) {
  await tx.execute(sql`select set_config('luxe.actor_user_id', ${userId}, true), set_config('luxe.status_reason', ${reason}, true)`);
}

/** Per-guest equipment for a booking, in resource-id order (the locking order). */
function perGuestRequirements(tx: Db, experienceId: string) {
  return tx
    .select({ resourceId: experienceResourceRequirements.resourceId, quantity: experienceResourceRequirements.quantity })
    .from(experienceResourceRequirements)
    .where(and(eq(experienceResourceRequirements.experienceId, experienceId), eq(experienceResourceRequirements.basis, "per_guest")))
    .orderBy(asc(experienceResourceRequirements.resourceId));
}

/** The guest's plan items for a slot, so a booking shows up in their itinerary. */
function guestPlanItems(tx: Db, guestId: string, slotId: string) {
  const plans = tx.select({ id: itineraryPlans.id }).from(itineraryPlans).where(eq(itineraryPlans.guestId, guestId));
  return and(eq(itineraryItems.slotId, slotId), inArray(itineraryItems.planId, plans));
}

function mapBookingError(error: unknown): DalResult<never> | null {
  const code = pgErrorCode(error);
  if (code === "LXB01") return fail("sold-out", "Sorry, this session has just filled up. Please pick another time.", "partySize");
  if (code === "LXR01") {
    return fail("not-enough-equipment", "The shared equipment for this time has just run out. Please pick another session.", "partySize");
  }
  if (code === "23505" && pgConstraint(error) === "bookings_one_active_per_guest_slot") {
    return fail("already-booked", "You already have a booking for this session. Change its guests from My bookings.");
  }
  return null;
}

export type BookingInput = { slotId: string; partySize: number; idempotencyKey: string };

/**
 * Books seats on a session for the signed-in guest, confirmed straight away with payment
 * at the resort. Retrying with the same idempotency key returns the first booking.
 */
export async function createBooking(
  db: Db,
  viewer: Viewer,
  input: BookingInput,
  now = new Date(),
): Promise<DalResult<{ reference: string; created: boolean }>> {
  const [profile] = await db
    .select({ id: guestProfiles.userId })
    .from(guestProfiles)
    .where(eq(guestProfiles.userId, viewer.userId))
    .limit(1);
  if (!profile) return fail("no-guest-profile", "This account has no guest profile, so it can't book. Sign in as a guest.");

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        const [previous] = await tx
          .select({ reference: bookings.reference })
          .from(bookings)
          .where(and(eq(bookings.guestId, viewer.userId), eq(bookings.idempotencyKey, input.idempotencyKey)))
          .limit(1);
        if (previous) return ok({ reference: previous.reference, created: false }, `Already booked: ${previous.reference}.`);

        // Lock the session row so seat and readiness checks see the latest bookings.
        const [slot] = await tx
          .select({
            id: experienceSlots.id,
            experienceId: experiences.id,
            title: experiences.title,
            experienceStatus: experiences.status,
            maxGroupSize: experiences.maxGroupSize,
            basePrice: experiences.basePrice,
            currency: experiences.currency,
            priceOverride: experienceSlots.priceOverride,
            status: experienceSlots.status,
            startsAt: experienceSlots.startsAt,
            capacity: experienceSlots.capacity,
            seatsBooked: experienceSlots.seatsBooked,
          })
          .from(experienceSlots)
          .innerJoin(experiences, eq(experiences.id, experienceSlots.experienceId))
          .where(eq(experienceSlots.id, input.slotId))
          .for("update", { of: experienceSlots });

        if (!slot || slot.experienceStatus !== "published") return fail("slot-not-found", "That session no longer exists.");
        if (slot.status === "cancelled") return fail("slot-unavailable", "This session was cancelled. Please pick another time.");
        if (slot.status === "completed" || slot.startsAt <= now) return fail("slot-in-past", "This session has already started.");
        if (!isBookable(slot.startsAt.toISOString(), now)) {
          return fail(
            "booking-closed",
            `Online booking closes ${BOOKING_POLICY.cutoffHours} hours before the start. Please contact the resort team.`,
          );
        }
        const maxParty = Math.min(slot.capacity, slot.maxGroupSize);
        if (input.partySize > maxParty) {
          return fail("party-too-large", `${slot.title} takes up to ${maxParty} guests per session.`, "partySize");
        }
        const seatsLeft = slot.capacity - slot.seatsBooked;
        if (input.partySize > seatsLeft) {
          return fail(
            "sold-out",
            seatsLeft > 0 ? `Only ${seatsLeft} seat${seatsLeft === 1 ? "" : "s"} left for this session.` : "This session is full.",
            "partySize",
          );
        }
        const [readiness] = await tx.select(readinessColumns).from(slotReadiness).where(eq(slotReadiness.slotId, slot.id));
        const notReady = readiness ? readinessProblem(readiness, input.partySize) : null;
        if (notReady) return notReady;

        await setActor(tx, viewer.userId, "Booked online (pay at resort)");
        const [booking] = await tx
          .insert(bookings)
          .values({
            reference: newReference(),
            guestId: viewer.userId,
            slotId: slot.id,
            partySize: input.partySize,
            // Price from the database at booking time, never from the client.
            unitPrice: slot.priceOverride ?? slot.basePrice,
            currency: slot.currency,
            status: "confirmed",
            idempotencyKey: input.idempotencyKey,
          })
          .onConflictDoNothing({ target: [bookings.guestId, bookings.idempotencyKey] })
          .returning({ id: bookings.id, reference: bookings.reference, total: bookings.totalAmount });
        if (!booking) {
          // A parallel retry of the same request won the race; return its booking.
          const [winner] = await tx
            .select({ reference: bookings.reference })
            .from(bookings)
            .where(and(eq(bookings.guestId, viewer.userId), eq(bookings.idempotencyKey, input.idempotencyKey)));
          return ok({ reference: winner.reference, created: false }, `Already booked: ${winner.reference}.`);
        }

        const requirements = await perGuestRequirements(tx, slot.experienceId);
        for (const requirement of requirements) {
          await tx.insert(resourceAllocations).values({
            resourceId: requirement.resourceId,
            slotId: slot.id,
            bookingId: booking.id,
            quantity: requirement.quantity * input.partySize,
          });
        }

        await tx
          .update(itineraryItems)
          .set({ bookingId: booking.id, partySize: input.partySize })
          .where(and(guestPlanItems(tx, viewer.userId, slot.id), isNull(itineraryItems.bookingId)));

        const when = `${formatDate(slot.startsAt.toISOString())} at ${formatTime(slot.startsAt.toISOString())}`;
        const total = formatAmount(decimalToMinor(booking.total ?? "0"), slot.currency);
        return ok(
          { reference: booking.reference, created: true },
          `Booked: ${slot.title}, ${when}, ${input.partySize} guest${input.partySize === 1 ? "" : "s"}. Reference ${booking.reference}. ${total} payable at the resort.`,
        );
      });
    } catch (error) {
      // A generated reference collided (very unlikely): try again with a new one.
      if (pgErrorCode(error) === "23505" && pgConstraint(error) === "bookings_reference_key" && attempt < 2) continue;
      const mapped = mapBookingError(error);
      if (mapped) return mapped;
      throw error;
    }
  }
  return fail("server-error", "Couldn't create a booking reference. Please try again.");
}

/** The viewer's own booking (or any booking, for administrators), locked for change. */
async function lockBooking(tx: Db, viewer: Viewer, reference: string) {
  const [row] = await tx
    .select({
      id: bookings.id,
      guestId: bookings.guestId,
      slotId: bookings.slotId,
      status: bookings.status,
      partySize: bookings.partySize,
      startsAt: experienceSlots.startsAt,
      capacity: experienceSlots.capacity,
      seatsBooked: experienceSlots.seatsBooked,
      maxGroupSize: experiences.maxGroupSize,
      experienceId: experiences.id,
      title: experiences.title,
    })
    .from(bookings)
    .innerJoin(experienceSlots, eq(experienceSlots.id, bookings.slotId))
    .innerJoin(experiences, eq(experiences.id, experienceSlots.experienceId))
    .where(eq(bookings.reference, reference))
    .for("update", { of: [experienceSlots, bookings] });
  // Someone else's booking looks exactly like one that doesn't exist.
  if (!row || (row.guestId !== viewer.userId && viewer.role !== "admin")) return null;
  return row;
}

/**
 * Cancels a booking: releases its seats (trigger) and equipment, and returns linked plan
 * items to "planned". Guests can cancel online until 24 hours before the start;
 * administrators can cancel at any time.
 */
export async function cancelBooking(db: Db, viewer: Viewer, reference: string, now = new Date()): Promise<DalResult<null>> {
  return db.transaction(async (tx) => {
    const booking = await lockBooking(tx, viewer, reference);
    if (!booking) return fail("not-found", "That booking doesn't exist or isn't yours.");
    if (!isActiveBooking(booking.status)) return fail("not-cancellable", `This booking is already ${booking.status.replace("_", " ")}.`);
    const isAdmin = viewer.role === "admin";
    if (!isAdmin && !isChangeable({ status: booking.status, startsAt: booking.startsAt.toISOString() }, now)) {
      return fail(
        "too-late",
        `Online cancellation closes ${BOOKING_POLICY.changeHours} hours before the start. Please contact the resort team.`,
      );
    }

    await setActor(tx, viewer.userId, isAdmin && booking.guestId !== viewer.userId ? "Cancelled by an administrator" : "Cancelled by the guest");
    await tx
      .update(resourceAllocations)
      .set({ status: "released" })
      .where(and(eq(resourceAllocations.bookingId, booking.id), eq(resourceAllocations.status, "held")));
    await tx.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, booking.id));
    await tx.update(itineraryItems).set({ bookingId: null }).where(eq(itineraryItems.bookingId, booking.id));
    return ok(null, "Booking cancelled. The seats are released and nothing is charged.");
  });
}

/** Changes the number of guests on a booking, adjusting seats (trigger) and equipment. */
export async function changeBookingGuests(
  db: Db,
  viewer: Viewer,
  input: { reference: string; partySize: number },
  now = new Date(),
): Promise<DalResult<null>> {
  try {
    return await db.transaction(async (tx) => {
      const booking = await lockBooking(tx, viewer, input.reference);
      if (!booking) return fail("not-found", "That booking doesn't exist or isn't yours.");
      if (!isChangeable({ status: booking.status, startsAt: booking.startsAt.toISOString() }, now)) {
        return isActiveBooking(booking.status)
          ? fail("too-late", `Changes close ${BOOKING_POLICY.changeHours} hours before the start. Please contact the resort team.`)
          : fail("not-changeable", `This booking is ${booking.status.replace("_", " ")}.`);
      }
      if (input.partySize === booking.partySize) return ok(null, "No change needed.");

      const maxParty = Math.min(booking.capacity, booking.maxGroupSize);
      if (input.partySize > maxParty) {
        return fail("party-too-large", `${booking.title} takes up to ${maxParty} guests per session.`, "partySize");
      }
      const extra = input.partySize - booking.partySize;
      if (extra > 0) {
        const seatsLeft = booking.capacity - booking.seatsBooked;
        if (extra > seatsLeft) {
          return fail("sold-out", `Only ${seatsLeft} more seat${seatsLeft === 1 ? "" : "s"} available for this session.`, "partySize");
        }
        const [readiness] = await tx.select(readinessColumns).from(slotReadiness).where(eq(slotReadiness.slotId, booking.slotId));
        const notReady = readiness ? readinessProblem(readiness, extra) : null;
        if (notReady) return notReady;
      }

      await setActor(tx, viewer.userId, `Guests changed from ${booking.partySize} to ${input.partySize}`);
      // Seats first (slot row lock), then equipment (resource rows), as everywhere else.
      await tx.update(bookings).set({ partySize: input.partySize }).where(eq(bookings.id, booking.id));
      for (const requirement of await perGuestRequirements(tx, booking.experienceId)) {
        await tx
          .update(resourceAllocations)
          .set({ quantity: requirement.quantity * input.partySize })
          .where(
            and(
              eq(resourceAllocations.bookingId, booking.id),
              eq(resourceAllocations.resourceId, requirement.resourceId),
              eq(resourceAllocations.status, "held"),
            ),
          );
      }
      await tx.update(itineraryItems).set({ partySize: input.partySize }).where(eq(itineraryItems.bookingId, booking.id));
      return ok(null, `Updated to ${input.partySize} guest${input.partySize === 1 ? "" : "s"}.`);
    });
  } catch (error) {
    const mapped = mapBookingError(error);
    if (mapped) return mapped;
    throw error;
  }
}
