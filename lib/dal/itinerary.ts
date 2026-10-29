import "server-only";

import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";

import {
  bookings,
  experienceCategories,
  experiences,
  experienceSlots,
  itineraryItems,
  itineraryPlans,
  slotReadiness,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { formatDate, formatDateKey } from "@/lib/format";
import { isOutsideStay, MAX_ITEMS_PER_PLAN, MAX_PLANS_PER_GUEST, overlaps } from "@/lib/itinerary";
import { decimalToMinor, minorToDecimal } from "@/lib/money";
import type { ItineraryPlan, ItineraryPlanSummary, PlannedItem } from "@/lib/types/guest";
import type { PlanInput } from "@/lib/validation/schemas";

import { fail, ok, type DalResult } from "./errors";
import { toCategory } from "./mappers";
import { readinessColumns, readinessProblem } from "./readiness";

// Every query is scoped to the plan owner's guest ID: another guest's plan IDs
// behave exactly like IDs that don't exist.

const planSummaryColumns = {
  id: itineraryPlans.id,
  name: itineraryPlans.name,
  arrival: itineraryPlans.arrivalDate,
  departure: itineraryPlans.departureDate,
  activityBudget: itineraryPlans.activityBudget,
  currency: itineraryPlans.currency,
  updatedAt: itineraryPlans.updatedAt,
};

type PlanSummaryRow = { activityBudget: string | null; updatedAt: Date };

/** Database plan row → app shape: money in minor units, ISO timestamps. */
function toPlanSummary<T extends PlanSummaryRow>({ activityBudget, updatedAt, ...rest }: T) {
  return {
    ...rest,
    activityBudgetMinor: activityBudget === null ? null : decimalToMinor(activityBudget),
    updatedAt: updatedAt.toISOString(),
  };
}

export async function listPlans(db: Db, guestId: string): Promise<ItineraryPlanSummary[]> {
  const rows = await db
    .select({ ...planSummaryColumns, itemCount: count(itineraryItems.id) })
    .from(itineraryPlans)
    .leftJoin(itineraryItems, eq(itineraryItems.planId, itineraryPlans.id))
    .where(eq(itineraryPlans.guestId, guestId))
    .groupBy(itineraryPlans.id)
    .orderBy(desc(itineraryPlans.updatedAt));
  return rows.map(toPlanSummary);
}

async function ownedPlan(db: Db, guestId: string, planId: string) {
  const [plan] = await db
    .select(planSummaryColumns)
    .from(itineraryPlans)
    .where(and(eq(itineraryPlans.id, planId), eq(itineraryPlans.guestId, guestId)))
    .limit(1);
  return plan ?? null;
}

async function planItems(db: Db, guestId: string, planId: string): Promise<PlannedItem[]> {
  const rows = await db
    .select({
      id: itineraryItems.id,
      slotId: itineraryItems.slotId,
      partySize: itineraryItems.partySize,
      startsAt: experienceSlots.startsAt,
      endsAt: experienceSlots.endsAt,
      slotStatus: experienceSlots.status,
      capacity: experienceSlots.capacity,
      seatsBooked: experienceSlots.seatsBooked,
      priceOverride: experienceSlots.priceOverride,
      slug: experiences.slug,
      title: experiences.title,
      basePrice: experiences.basePrice,
      currency: experiences.currency,
      imageUrl: experiences.imageUrl,
      categorySlug: experienceCategories.slug,
      bookingReference: bookings.reference,
      bookingStatus: bookings.status,
    })
    .from(itineraryItems)
    .innerJoin(itineraryPlans, eq(itineraryPlans.id, itineraryItems.planId))
    .innerJoin(experienceSlots, eq(experienceSlots.id, itineraryItems.slotId))
    .innerJoin(experiences, eq(experiences.id, experienceSlots.experienceId))
    .innerJoin(experienceCategories, eq(experienceCategories.id, experiences.categoryId))
    .leftJoin(bookings, eq(bookings.id, itineraryItems.bookingId))
    .where(and(eq(itineraryItems.planId, planId), eq(itineraryPlans.guestId, guestId)))
    .orderBy(asc(experienceSlots.startsAt));

  return rows.map((row) => ({
    id: row.id,
    slotId: row.slotId,
    experienceSlug: row.slug,
    title: row.title,
    category: toCategory(row.categorySlug),
    imageSrc: row.imageUrl,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    partySize: row.partySize,
    unitPriceMinor: decimalToMinor(row.priceOverride ?? row.basePrice),
    currency: row.currency,
    slotStatus: row.slotStatus,
    seatsLeft: row.capacity - row.seatsBooked,
    booking: row.bookingReference && row.bookingStatus ? { reference: row.bookingReference, status: row.bookingStatus } : null,
  }));
}

export async function getPlan(db: Db, guestId: string, planId: string): Promise<ItineraryPlan | null> {
  const plan = await ownedPlan(db, guestId, planId);
  if (!plan) return null;
  const items = await planItems(db, guestId, planId);
  return { ...toPlanSummary(plan), itemCount: items.length, items };
}

const planValues = (input: PlanInput) => ({
  name: input.name,
  arrivalDate: input.arrival,
  departureDate: input.departure,
  activityBudget: input.activityBudgetMinor === null ? null : minorToDecimal(input.activityBudgetMinor),
});

export async function createPlan(db: Db, guestId: string, input: PlanInput): Promise<DalResult<{ planId: string }>> {
  const [{ plans }] = await db.select({ plans: count() }).from(itineraryPlans).where(eq(itineraryPlans.guestId, guestId));
  if (plans >= MAX_PLANS_PER_GUEST) {
    return fail("too-many-plans", `You can keep up to ${MAX_PLANS_PER_GUEST} plans. Delete one to start another.`);
  }
  const [plan] = await db
    .insert(itineraryPlans)
    .values({ guestId, ...planValues(input) })
    .returning({ id: itineraryPlans.id });
  return ok({ planId: plan.id }, `Created “${input.name}”.`);
}

export async function updatePlan(
  db: Db,
  guestId: string,
  planId: string,
  input: PlanInput,
): Promise<DalResult<{ planId: string }>> {
  const updated = await db
    .update(itineraryPlans)
    .set(planValues(input))
    .where(and(eq(itineraryPlans.id, planId), eq(itineraryPlans.guestId, guestId)))
    .returning({ id: itineraryPlans.id });
  return updated.length ? ok({ planId }, "Plan saved.") : fail("plan-not-found", "That plan doesn't exist or isn't yours.");
}

export async function deletePlan(db: Db, guestId: string, planId: string): Promise<DalResult<null>> {
  const removed = await db
    .delete(itineraryPlans)
    .where(and(eq(itineraryPlans.id, planId), eq(itineraryPlans.guestId, guestId)))
    .returning({ id: itineraryPlans.id });
  return removed.length ? ok(null, "Plan deleted. Your bookings aren't affected.") : fail("plan-not-found", "That plan doesn't exist or isn't yours.");
}

/** The guest's chosen plan, their most recent one, or a new "My stay" plan. */
async function targetPlan(db: Db, guestId: string, planId: string | undefined) {
  if (planId) return ownedPlan(db, guestId, planId);
  const [latest] = await db
    .select(planSummaryColumns)
    .from(itineraryPlans)
    .where(eq(itineraryPlans.guestId, guestId))
    .orderBy(desc(itineraryPlans.updatedAt))
    .limit(1);
  if (latest) return latest;
  const [created] = await db.insert(itineraryPlans).values({ guestId, name: "My stay" }).returning(planSummaryColumns);
  return created;
}

const touchPlan = (db: Db, planId: string) =>
  db.update(itineraryPlans).set({ updatedAt: sql`now()` }).where(eq(itineraryPlans.id, planId));

/**
 * Adds a session to a plan (or updates its guest count if it's already there). Plans
 * never hold seats: seat counts are only checked so the guest isn't misled.
 */
export async function addItem(
  db: Db,
  guestId: string,
  input: { planId?: string; slotId: string; partySize: number },
  now = new Date(),
): Promise<DalResult<{ planId: string; itemId: string }>> {
  return db.transaction(async (tx) => {
    const plan = await targetPlan(tx, guestId, input.planId);
    if (!plan) return fail("plan-not-found", "That plan doesn't exist or isn't yours.");

    const [slot] = await tx
      .select({
        id: experienceSlots.id,
        startsAt: experienceSlots.startsAt,
        endsAt: experienceSlots.endsAt,
        status: experienceSlots.status,
        cancelledReason: experienceSlots.cancelledReason,
        capacity: experienceSlots.capacity,
        seatsBooked: experienceSlots.seatsBooked,
        title: experiences.title,
        maxGroupSize: experiences.maxGroupSize,
        experienceStatus: experiences.status,
        ...readinessColumns,
      })
      .from(experienceSlots)
      .innerJoin(experiences, eq(experiences.id, experienceSlots.experienceId))
      .leftJoin(slotReadiness, eq(slotReadiness.slotId, experienceSlots.id))
      .where(eq(experienceSlots.id, input.slotId))
      .limit(1);

    if (!slot || slot.experienceStatus !== "published") return fail("slot-not-found", "That session no longer exists.");
    if (slot.status === "cancelled") {
      return fail("slot-unavailable", `This session was cancelled${slot.cancelledReason ? `: ${slot.cancelledReason}` : ""}.`);
    }
    if (slot.status === "completed" || slot.startsAt <= now) {
      return fail("slot-in-past", "This session has already started, so it can't be planned.");
    }
    const maxParty = Math.min(slot.capacity, slot.maxGroupSize);
    if (input.partySize > maxParty) {
      return fail("party-too-large", `${slot.title} takes up to ${maxParty} guests per session.`, "partySize");
    }
    const seatsLeft = slot.capacity - slot.seatsBooked;
    if (input.partySize > seatsLeft) {
      return fail(
        "not-enough-seats",
        seatsLeft > 0
          ? `Only ${seatsLeft} seat${seatsLeft === 1 ? "" : "s"} left for this session. Plans don't hold seats.`
          : "This session is full.",
        "partySize",
      );
    }
    const notReady = readinessProblem(slot, input.partySize);
    if (notReady) return notReady;
    const startsAt = slot.startsAt.toISOString();
    if (isOutsideStay(startsAt, plan.arrival, plan.departure)) {
      return fail(
        "outside-stay",
        `This session is on ${formatDate(startsAt)}, outside your stay (${formatDateKey(plan.arrival ?? plan.departure!)} – ${formatDateKey(plan.departure ?? plan.arrival!)}). Change your stay dates or pick another session.`,
      );
    }

    const items = await planItems(tx, guestId, plan.id);
    const existing = items.find((item) => item.slotId === slot.id);
    let itemId: string;
    if (existing) {
      await tx.update(itineraryItems).set({ partySize: input.partySize }).where(eq(itineraryItems.id, existing.id));
      itemId = existing.id;
    } else {
      if (items.length >= MAX_ITEMS_PER_PLAN) {
        return fail("plan-full", `A plan can hold up to ${MAX_ITEMS_PER_PLAN} sessions.`);
      }
      const [item] = await tx
        .insert(itineraryItems)
        .values({ planId: plan.id, slotId: slot.id, partySize: input.partySize })
        .returning({ id: itineraryItems.id });
      itemId = item.id;
    }
    await touchPlan(tx, plan.id);

    const clashes = items.filter((item) => item.slotId !== slot.id && overlaps(item, { startsAt, endsAt: slot.endsAt.toISOString() }));
    const base = existing
      ? `Updated ${slot.title} to ${input.partySize} guest${input.partySize === 1 ? "" : "s"} in “${plan.name}”.`
      : `Added ${slot.title} to “${plan.name}”.`;
    const warning = clashes.length ? ` It overlaps with ${clashes.map((item) => item.title).join(", ")}.` : "";
    return ok({ planId: plan.id, itemId }, `${base}${warning} This is a plan, not a booking.`);
  });
}

async function ownedItem(db: Db, guestId: string, itemId: string) {
  const [item] = await db
    .select({ id: itineraryItems.id, planId: itineraryItems.planId, slotId: itineraryItems.slotId })
    .from(itineraryItems)
    .innerJoin(itineraryPlans, eq(itineraryPlans.id, itineraryItems.planId))
    .where(and(eq(itineraryItems.id, itemId), eq(itineraryPlans.guestId, guestId)))
    .limit(1);
  return item ?? null;
}

export async function updateItemPartySize(
  db: Db,
  guestId: string,
  input: { itemId: string; partySize: number },
): Promise<DalResult<null>> {
  return db.transaction(async (tx) => {
    const item = await ownedItem(tx, guestId, input.itemId);
    if (!item) return fail("item-not-found", "That plan item doesn't exist or isn't yours.");
    const [slot] = await tx
      .select({
        capacity: experienceSlots.capacity,
        seatsBooked: experienceSlots.seatsBooked,
        maxGroupSize: experiences.maxGroupSize,
        ...readinessColumns,
      })
      .from(experienceSlots)
      .innerJoin(experiences, eq(experiences.id, experienceSlots.experienceId))
      .leftJoin(slotReadiness, eq(slotReadiness.slotId, experienceSlots.id))
      .where(eq(experienceSlots.id, item.slotId));
    const maxParty = Math.min(slot.capacity, slot.maxGroupSize);
    if (input.partySize > maxParty) return fail("party-too-large", `Up to ${maxParty} guests per session.`, "partySize");
    const seatsLeft = slot.capacity - slot.seatsBooked;
    if (input.partySize > seatsLeft) {
      return fail("not-enough-seats", `Only ${Math.max(seatsLeft, 0)} seats left for this session.`, "partySize");
    }
    const notReady = readinessProblem(slot, input.partySize);
    if (notReady) return notReady;
    await tx.update(itineraryItems).set({ partySize: input.partySize }).where(eq(itineraryItems.id, item.id));
    await touchPlan(tx, item.planId);
    return ok(null, "Guests updated.");
  });
}

export async function removeItem(db: Db, guestId: string, itemId: string): Promise<DalResult<null>> {
  const ownedPlans = db.select({ id: itineraryPlans.id }).from(itineraryPlans).where(eq(itineraryPlans.guestId, guestId));
  const removed = await db
    .delete(itineraryItems)
    .where(and(eq(itineraryItems.id, itemId), inArray(itineraryItems.planId, ownedPlans)))
    .returning({ planId: itineraryItems.planId });
  if (!removed.length) return fail("item-not-found", "That plan item doesn't exist or isn't yours.");
  await touchPlan(db, removed[0].planId);
  return ok(null, "Removed from your plan.");
}
