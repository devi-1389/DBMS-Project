"use server";

import { refresh } from "next/cache";

import { fromDal, invalid, unexpected } from "@/lib/actions/results";
import { authorizeAction, type ActionResult } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { findSlotId } from "@/lib/dal/catalogue";
import { fail } from "@/lib/dal/errors";
import { addItem, createPlan, deletePlan, removeItem, updateItemPartySize, updatePlan } from "@/lib/dal/itinerary";
import {
  addItemSchema,
  addSessionSchema,
  idSchema,
  planSchema,
  updateItemSchema,
} from "@/lib/validation/schemas";

// Every action re-checks the signed-in guest and validates its input; the DAL scopes
// every query to that guest, so IDs belonging to someone else behave as "not found".

export async function createPlanAction(input: unknown): Promise<ActionResult<{ planId: string }>> {
  const access = await authorizeAction("guest");
  if (!access.ok) return access;
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const result = fromDal(await createPlan(getDb(), access.viewer.userId, parsed.data));
    if (result.ok) refresh();
    return result;
  } catch (error) {
    return unexpected(error, "createPlan");
  }
}

export async function updatePlanAction(planId: unknown, input: unknown): Promise<ActionResult<{ planId: string }>> {
  const access = await authorizeAction("guest");
  if (!access.ok) return access;
  const id = idSchema.safeParse(planId);
  if (!id.success) return invalid(id.error, "Unknown plan.");
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const result = fromDal(await updatePlan(getDb(), access.viewer.userId, id.data, parsed.data));
    if (result.ok) refresh();
    return result;
  } catch (error) {
    return unexpected(error, "updatePlan");
  }
}

export async function deletePlanAction(planId: unknown): Promise<ActionResult> {
  const access = await authorizeAction("guest");
  if (!access.ok) return access;
  const id = idSchema.safeParse(planId);
  if (!id.success) return invalid(id.error, "Unknown plan.");
  try {
    const result = fromDal(await deletePlan(getDb(), access.viewer.userId, id.data));
    if (result.ok) refresh();
    return result;
  } catch (error) {
    return unexpected(error, "deletePlan");
  }
}

/** Add a session by slot ID (recommendations, suggestions). */
export async function addToPlanAction(input: unknown): Promise<ActionResult<{ planId: string; itemId: string }>> {
  const access = await authorizeAction("guest");
  if (!access.ok) return access;
  const parsed = addItemSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const result = fromDal(await addItem(getDb(), access.viewer.userId, parsed.data));
    if (result.ok) refresh();
    return result;
  } catch (error) {
    return unexpected(error, "addToPlan");
  }
}

/** Add a session by experience and start time (experience pages). */
export async function addSessionToPlanAction(input: unknown): Promise<ActionResult<{ planId: string; itemId: string }>> {
  const access = await authorizeAction("guest");
  if (!access.ok) return access;
  const parsed = addSessionSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const db = getDb();
    const slotId = await findSlotId(db, parsed.data.experienceSlug, new Date(parsed.data.startsAt));
    if (!slotId) return fromDal(fail("slot-not-found", "That session isn't in our schedule."));
    const result = fromDal(
      await addItem(db, access.viewer.userId, { planId: parsed.data.planId, slotId, partySize: parsed.data.partySize }),
    );
    if (result.ok) refresh();
    return result;
  } catch (error) {
    return unexpected(error, "addSessionToPlan");
  }
}

export async function updatePlanItemAction(input: unknown): Promise<ActionResult> {
  const access = await authorizeAction("guest");
  if (!access.ok) return access;
  const parsed = updateItemSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const result = fromDal(await updateItemPartySize(getDb(), access.viewer.userId, parsed.data));
    if (result.ok) refresh();
    return result;
  } catch (error) {
    return unexpected(error, "updatePlanItem");
  }
}

export async function removePlanItemAction(itemId: unknown): Promise<ActionResult> {
  const access = await authorizeAction("guest");
  if (!access.ok) return access;
  const id = idSchema.safeParse(itemId);
  if (!id.success) return invalid(id.error, "Unknown plan item.");
  try {
    const result = fromDal(await removeItem(getDb(), access.viewer.userId, id.data));
    if (result.ok) refresh();
    return result;
  } catch (error) {
    return unexpected(error, "removePlanItem");
  }
}
