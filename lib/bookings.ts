// SOLACE booking policy, shared by the server (enforced) and the UI (explained).
// Payment is taken at the resort for now (docs/IMPLEMENTATION_PLAN.md, decision 1).
import type { BookingStatus } from "@/lib/types/booking";

export const BOOKING_POLICY = {
  /** Online booking closes this long before a session starts. */
  cutoffHours: 2,
  /** Guests can cancel or change online until this long before the start. */
  changeHours: 24,
  paymentMethod: "pay_at_resort",
} as const;

const HOUR = 3_600_000;

const ACTIVE: BookingStatus[] = ["pending", "confirmed"];

export const isActiveBooking = (status: BookingStatus) => ACTIVE.includes(status);

/** Can this session still be booked online? */
export function isBookable(startsAt: string, now: Date) {
  return Date.parse(startsAt) - now.getTime() >= BOOKING_POLICY.cutoffHours * HOUR;
}

/** Can the guest still cancel or change this booking online? */
export function isChangeable(booking: { status: BookingStatus; startsAt: string }, now: Date) {
  return isActiveBooking(booking.status) && Date.parse(booking.startsAt) - now.getTime() >= BOOKING_POLICY.changeHours * HOUR;
}
