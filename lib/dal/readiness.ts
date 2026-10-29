import "server-only";

import { slotReadiness } from "@/lib/db/schema";
import { joinList } from "@/lib/format";

import { fail } from "./errors";

export const readinessColumns = {
  ready: slotReadiness.ready,
  staffAssigned: slotReadiness.staffAssigned,
  missing: slotReadiness.resourcesMissing,
  bookableSeats: slotReadiness.bookableSeats,
  limitingResource: slotReadiness.limitingResource,
};

export type ReadinessCheck = {
  ready: boolean | null;
  staffAssigned: number | null;
  missing: string[] | null;
  bookableSeats: number | null;
  limitingResource: string | null;
};

/**
 * LUXE-ECO availability check: the session needs its guide or host, its venue/boats/
 * vehicle, and enough units in shared equipment pools for the party.
 */
export function readinessProblem(slot: ReadinessCheck, partySize: number) {
  if (slot.ready === false) {
    const missing = slot.missing ?? [];
    const why = !slot.staffAssigned
      ? "no guide or host is assigned yet"
      : `${joinList(missing)} ${missing.length > 1 ? "aren't" : "isn't"} available`;
    return fail("slot-not-ready", `This session can't run as scheduled: ${why}. Please pick another session.`);
  }
  if (slot.bookableSeats !== null && partySize > slot.bookableSeats) {
    const places = `${slot.bookableSeats} ${slot.bookableSeats === 1 ? "place" : "places"}`;
    return fail(
      "not-enough-equipment",
      `Only ${places} left: the shared ${slot.limitingResource ?? "equipment"} pool is nearly in use for this time.`,
      "partySize",
    );
  }
  return null;
}
