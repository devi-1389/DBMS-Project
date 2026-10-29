import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { experienceSlots } from "./catalogue";
import { createdAt, currencyCode, money, moneyTotal, updatedAt } from "./columns";
import { bookingStatus, paymentMethod, paymentStatus, reviewStatus } from "./enums";
import { guestProfiles, staffMembers, users } from "./identity";

/**
 * A reservation of seats on one slot. Seat accounting, allowed status transitions
 * and the status history are enforced by triggers (drizzle/0001_integrity.sql).
 */
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull().unique("bookings_reference_key"),
    guestId: uuid("guest_id")
      .notNull()
      .references(() => guestProfiles.userId, { onDelete: "restrict" }),
    slotId: uuid("slot_id")
      .notNull()
      .references(() => experienceSlots.id, { onDelete: "restrict" }),
    partySize: smallint("party_size").notNull(),
    /** Price per guest at the time of booking (snapshot; later price changes don't apply). */
    unitPrice: money("unit_price").notNull(),
    currency: currencyCode(),
    totalAmount: moneyTotal("total_amount").generatedAlwaysAs(sql`(unit_price * party_size)::numeric(12, 2)`),
    status: bookingStatus("status").notNull().default("pending"),
    /** Pending bookings hold seats until this time. */
    holdExpiresAt: timestamp("hold_expires_at", { withTimezone: true }),
    /** Client-generated key so a retried request can't create a second booking. */
    idempotencyKey: uuid("idempotency_key").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("bookings_guest_idempotency_key").on(t.guestId, t.idempotencyKey),
    uniqueIndex("bookings_one_active_per_guest_slot")
      .on(t.guestId, t.slotId)
      .where(sql`status in ('pending', 'confirmed')`),
    index("bookings_slot_status_idx").on(t.slotId, t.status),
    index("bookings_guest_created_idx").on(t.guestId, t.createdAt),
    check("bookings_reference_format", sql`${t.reference} ~ '^LX-[A-Z0-9]{4,10}$'`),
    check("bookings_party_size_range", sql`${t.partySize} between 1 and 100`),
    check("bookings_unit_price_non_negative", sql`${t.unitPrice} >= 0`),
    check("bookings_currency_format", sql`${t.currency} ~ '^[A-Z]{3}$'`),
    check("bookings_pending_has_hold", sql`${t.status} <> 'pending' or ${t.holdExpiresAt} is not null`),
  ],
);

/** Append-only audit of status changes, written by trigger. */
export const bookingStatusHistory = pgTable(
  "booking_status_history",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    fromStatus: bookingStatus("from_status"),
    toStatus: bookingStatus("to_status").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
    changedByUserId: uuid("changed_by_user_id").references(() => users.id, { onDelete: "set null" }),
    reason: text("reason"),
  },
  (t) => [
    index("booking_status_history_booking_idx").on(t.bookingId, t.changedAt),
    check("booking_status_history_changes_status", sql`${t.fromStatus} is distinct from ${t.toStatus}`),
  ],
);

/** Every attempt to take or record payment for a booking. */
export const paymentAttempts = pgTable(
  "payment_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    amount: moneyTotal("amount").notNull(),
    currency: currencyCode(),
    method: paymentMethod("method").notNull(),
    status: paymentStatus("status").notNull().default("initiated"),
    /** Payment provider name and its reference (card payments). */
    provider: text("provider"),
    providerReference: text("provider_reference").unique("payment_attempts_provider_reference_key"),
    failureReason: text("failure_reason"),
    /** Staff member who recorded a pay-at-resort payment. */
    recordedByStaffId: uuid("recorded_by_staff_id").references(() => staffMembers.id, { onDelete: "restrict" }),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
    settledAt: timestamp("settled_at", { withTimezone: true }),
  },
  (t) => [
    index("payment_attempts_booking_idx").on(t.bookingId, t.attemptedAt),
    uniqueIndex("payment_attempts_one_success_per_booking").on(t.bookingId).where(sql`status = 'succeeded'`),
    check("payment_attempts_amount_positive", sql`${t.amount} > 0`),
    check("payment_attempts_currency_format", sql`${t.currency} ~ '^[A-Z]{3}$'`),
    check(
      "payment_attempts_card_success_has_reference",
      sql`${t.method} <> 'card' or ${t.status} <> 'succeeded' or ${t.providerReference} is not null`,
    ),
    check(
      "payment_attempts_settled_when_final",
      sql`(${t.status} in ('succeeded', 'refunded')) = (${t.settledAt} is not null)`,
    ),
    check("payment_attempts_failure_has_reason", sql`${t.status} <> 'failed' or ${t.failureReason} is not null`),
  ],
);

/** One review per completed booking (completion is checked by trigger). */
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .unique("reviews_booking_key")
      .references(() => bookings.id, { onDelete: "restrict" }),
    rating: smallint("rating").notNull(),
    title: text("title"),
    body: text("body"),
    status: reviewStatus("status").notNull().default("pending"),
    createdAt: createdAt(),
    moderatedByUserId: uuid("moderated_by_user_id").references(() => users.id, { onDelete: "set null" }),
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
  },
  (t) => [
    index("reviews_status_created_idx").on(t.status, t.createdAt),
    check("reviews_rating_range", sql`${t.rating} between 1 and 5`),
    check("reviews_title_length", sql`${t.title} is null or char_length(${t.title}) between 1 and 120`),
    check("reviews_body_length", sql`${t.body} is null or char_length(${t.body}) <= 4000`),
  ],
);
