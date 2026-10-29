import { sql } from "drizzle-orm";
import { check, date, index, pgTable, smallint, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { bookings } from "./bookings";
import { experienceSlots } from "./catalogue";
import { createdAt, updatedAt } from "./columns";
import { guestProfiles } from "./identity";

/** A guest's plan for a stay. Items are plans, not reservations. */
export const itineraryPlans = pgTable(
  "itinerary_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    guestId: uuid("guest_id")
      .notNull()
      .references(() => guestProfiles.userId, { onDelete: "cascade" }),
    name: text("name").notNull().default("My stay"),
    arrivalDate: date("arrival_date"),
    departureDate: date("departure_date"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("itinerary_plans_guest_idx").on(t.guestId),
    check("itinerary_plans_name_length", sql`char_length(${t.name}) between 1 and 80`),
    check(
      "itinerary_plans_stay_range",
      sql`${t.arrivalDate} is null or ${t.departureDate} is null or (${t.departureDate} >= ${t.arrivalDate} and ${t.departureDate} - ${t.arrivalDate} <= 21)`,
    ),
  ],
);

export const itineraryItems = pgTable(
  "itinerary_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => itineraryPlans.id, { onDelete: "cascade" }),
    slotId: uuid("slot_id")
      .notNull()
      .references(() => experienceSlots.id, { onDelete: "cascade" }),
    partySize: smallint("party_size").notNull(),
    /** Set once the planned session has been booked. */
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    note: text("note"),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("itinerary_items_plan_slot_key").on(t.planId, t.slotId),
    index("itinerary_items_slot_idx").on(t.slotId),
    index("itinerary_items_booking_idx").on(t.bookingId),
    check("itinerary_items_party_size_range", sql`${t.partySize} between 1 and 100`),
    check("itinerary_items_note_length", sql`${t.note} is null or char_length(${t.note}) <= 300`),
  ],
);
