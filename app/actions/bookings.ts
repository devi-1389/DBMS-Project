"use server";

import { refresh } from "next/cache";

import { fromDal, invalid, unexpected } from "@/lib/actions/results";
import { authorizeAction, type ActionResult } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { cancelBooking, changeBookingGuests, createBooking } from "@/lib/dal/booking-writes";
import { bookingReferenceSchema, bookSessionSchema, changeGuestsSchema } from "@/lib/validation/schemas";

// Signed-in users book for themselves only: the guest ID comes from the session, the
// price and seats from the database. The DAL scopes changes to the viewer's own bookings
// (administrators may cancel any booking).

export async function createBookingAction(input: unknown): Promise<ActionResult<{ reference: string; created: boolean }>> {
  const access = await authorizeAction("guest");
  if (!access.ok) return access;
  const parsed = bookSessionSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const result = fromDal(await createBooking(getDb(), access.viewer, parsed.data));
    if (result.ok) refresh();
    return result;
  } catch (error) {
    return unexpected(error, "createBooking");
  }
}

export async function cancelBookingAction(reference: unknown): Promise<ActionResult> {
  const access = await authorizeAction("guest");
  if (!access.ok) return access;
  const parsed = bookingReferenceSchema.safeParse(reference);
  if (!parsed.success) return invalid(parsed.error, "Unknown booking.");
  try {
    const result = fromDal(await cancelBooking(getDb(), access.viewer, parsed.data));
    if (result.ok) refresh();
    return result;
  } catch (error) {
    return unexpected(error, "cancelBooking");
  }
}

export async function changeBookingGuestsAction(input: unknown): Promise<ActionResult> {
  const access = await authorizeAction("guest");
  if (!access.ok) return access;
  const parsed = changeGuestsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const result = fromDal(await changeBookingGuests(getDb(), access.viewer, parsed.data));
    if (result.ok) refresh();
    return result;
  } catch (error) {
    return unexpected(error, "changeBookingGuests");
  }
}
