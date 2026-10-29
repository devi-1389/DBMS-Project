import { boolean, integer, numeric, pgView, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { slotStatus } from "./enums";

// Views are created in drizzle/0001_integrity.sql and drizzle/0004_slot_readiness.sql.
// `.existing()` gives typed reads without drizzle-kit trying to manage them.

export const slotAvailability = pgView("slot_availability", {
  slotId: uuid("slot_id").notNull(),
  experienceId: uuid("experience_id").notNull(),
  experienceSlug: text("experience_slug").notNull(),
  experienceTitle: text("experience_title").notNull(),
  categorySlug: text("category_slug").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  capacity: smallint("capacity").notNull(),
  seatsBooked: smallint("seats_booked").notNull(),
  seatsLeft: integer("seats_left").notNull(),
  pricePerGuest: numeric("price_per_guest", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  status: slotStatus("status").notNull(),
}).existing();

export const experienceRatings = pgView("experience_ratings", {
  experienceId: uuid("experience_id").notNull(),
  experienceSlug: text("experience_slug").notNull(),
  reviewCount: integer("review_count").notNull(),
  averageRating: numeric("average_rating", { precision: 3, scale: 2 }),
}).existing();

/** Whether a session has its guide/host and resources, and how many guests shared pools can take. */
export const slotReadiness = pgView("slot_readiness", {
  slotId: uuid("slot_id").notNull(),
  staffAssigned: integer("staff_assigned").notNull(),
  staffNames: text("staff_names").array().notNull(),
  resourcesConfirmed: text("resources_confirmed").array().notNull(),
  resourcesMissing: text("resources_missing").array().notNull(),
  /** Extra guests the per-guest equipment pools can take; NULL when none are needed. */
  guestLimit: integer("guest_limit"),
  limitingResource: text("limiting_resource"),
  ready: boolean("ready").notNull(),
  bookableSeats: integer("bookable_seats").notNull(),
}).existing();
