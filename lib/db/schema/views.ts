import { integer, numeric, pgView, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { slotStatus } from "./enums";

// Views are created in drizzle/0001_integrity.sql. `.existing()` gives typed reads
// without drizzle-kit trying to manage them.

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
