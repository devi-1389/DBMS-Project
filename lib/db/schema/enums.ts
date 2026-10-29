import { pgEnum } from "drizzle-orm/pg-core";

// Relative imports only: drizzle-kit loads this file outside Next.js, without the `@/` alias.
import { DIFFICULTIES } from "../../difficulty";
import type { BookingStatus } from "../../types/booking";
import type { TimeOfDay } from "../../types/guest";

export const userRole = pgEnum("user_role", ["guest", "staff", "admin"]);
export const authProvider = pgEnum("auth_provider", ["clerk"]);

/** Same values as the app's Difficulty type. */
export const difficulty = pgEnum("difficulty", DIFFICULTIES);

const TIMES_OF_DAY = ["morning", "daytime", "evening"] as const satisfies readonly TimeOfDay[];
export const timeOfDay = pgEnum("time_of_day", TIMES_OF_DAY);

export const experienceStatus = pgEnum("experience_status", ["draft", "published", "archived"]);
export const slotStatus = pgEnum("slot_status", ["scheduled", "cancelled", "completed"]);

const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
] as const satisfies readonly BookingStatus[];
export const bookingStatus = pgEnum("booking_status", BOOKING_STATUSES);

export const paymentMethod = pgEnum("payment_method", ["pay_at_resort", "card"]);
export const paymentStatus = pgEnum("payment_status", ["initiated", "succeeded", "failed", "refunded"]);
export const reviewStatus = pgEnum("review_status", ["pending", "published", "hidden"]);

export const supplierKind = pgEnum("supplier_kind", [
  "activity_operator",
  "local_host",
  "equipment_rental",
  "food_producer",
  "transport",
]);

export const assignmentRole = pgEnum("assignment_role", ["lead", "guide", "support"]);
export const assignmentStatus = pgEnum("assignment_status", ["assigned", "released"]);

export const resourceKind = pgEnum("resource_kind", ["vehicle", "watercraft", "equipment", "venue", "other"]);
/** per_session: fixed amount per slot. per_guest: quantity × party size, allocated per booking. */
export const requirementBasis = pgEnum("requirement_basis", ["per_session", "per_guest"]);
export const allocationStatus = pgEnum("allocation_status", ["held", "released"]);
