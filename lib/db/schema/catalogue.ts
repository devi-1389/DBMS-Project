import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, currencyCode, money, tstzrange, updatedAt } from "./columns";
import { difficulty, experienceStatus, slotStatus, supplierKind } from "./enums";
import { users } from "./identity";
import { interests } from "./preferences";

export const experienceCategories = pgTable(
  "experience_categories",
  {
    id: smallint("id").primaryKey().generatedAlwaysAsIdentity(),
    slug: text("slug").notNull().unique("experience_categories_slug_key"),
    label: text("label").notNull(),
    tagline: text("tagline"),
    description: text("description"),
    sortOrder: smallint("sort_order").notNull().default(0),
  },
  (t) => [
    check("experience_categories_slug_format", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check("experience_categories_label_length", sql`char_length(${t.label}) between 1 and 60`),
  ],
);

/** External partners: activity operators, local hosts, rental firms, producers. */
export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique("suppliers_name_key"),
    kind: supplierKind("kind").notNull(),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("suppliers_name_length", sql`char_length(${t.name}) between 2 and 120`),
    check(
      "suppliers_contact_email_format",
      sql`${t.contactEmail} is null or ${t.contactEmail} ~* '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$'`,
    ),
  ],
);

export const experiences = pgTable(
  "experiences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: smallint("category_id")
      .notNull()
      .references(() => experienceCategories.id, { onDelete: "restrict" }),
    supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "restrict" }),
    slug: text("slug").notNull().unique("experiences_slug_key"),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    description: text("description").notNull(),
    location: text("location").notNull(),
    meetingPoint: text("meeting_point").notNull(),
    difficulty: difficulty("difficulty").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    minAge: smallint("min_age").notNull().default(0),
    /** Default capacity for new slots. */
    maxGroupSize: smallint("max_group_size").notNull(),
    basePrice: money("base_price").notNull(),
    currency: currencyCode(),
    isStepFree: boolean("is_step_free").notNull().default(false),
    isFeatured: boolean("is_featured").notNull().default(false),
    status: experienceStatus("status").notNull().default("draft"),
    imageUrl: text("image_url"),
    imageAlt: text("image_alt"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("experiences_category_status_idx").on(t.categoryId, t.status),
    index("experiences_supplier_idx").on(t.supplierId),
    check("experiences_slug_format", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check("experiences_title_length", sql`char_length(${t.title}) between 3 and 120`),
    check("experiences_summary_length", sql`char_length(${t.summary}) between 10 and 300`),
    check("experiences_duration_range", sql`${t.durationMinutes} between 15 and 1440`),
    check("experiences_min_age_range", sql`${t.minAge} between 0 and 99`),
    check("experiences_group_size_range", sql`${t.maxGroupSize} between 1 and 100`),
    check("experiences_base_price_non_negative", sql`${t.basePrice} >= 0`),
    check("experiences_currency_format", sql`${t.currency} ~ '^[A-Z]{3}$'`),
    check("experiences_image_url_format", sql`${t.imageUrl} is null or ${t.imageUrl} ~ '^(/|https://)'`),
  ],
);

/** Ordered highlight bullets (multi-valued attribute, kept in 1NF). */
export const experienceHighlights = pgTable(
  "experience_highlights",
  {
    experienceId: uuid("experience_id")
      .notNull()
      .references(() => experiences.id, { onDelete: "cascade" }),
    position: smallint("position").notNull(),
    text: text("text").notNull(),
  },
  (t) => [
    primaryKey({ name: "experience_highlights_pkey", columns: [t.experienceId, t.position] }),
    check("experience_highlights_position_positive", sql`${t.position} >= 1`),
    check("experience_highlights_text_length", sql`char_length(${t.text}) between 1 and 200`),
  ],
);

/** M:N experience ↔ interest. */
export const experienceInterests = pgTable(
  "experience_interests",
  {
    experienceId: uuid("experience_id")
      .notNull()
      .references(() => experiences.id, { onDelete: "cascade" }),
    interestId: smallint("interest_id")
      .notNull()
      .references(() => interests.id, { onDelete: "restrict" }),
  },
  (t) => [
    primaryKey({ name: "experience_interests_pkey", columns: [t.experienceId, t.interestId] }),
    index("experience_interests_interest_idx").on(t.interestId),
  ],
);

/**
 * A scheduled session. `seats_booked` is maintained only by the bookings trigger,
 * under the slot's row lock, and the check constraint caps it at `capacity`.
 */
export const experienceSlots = pgTable(
  "experience_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    experienceId: uuid("experience_id")
      .notNull()
      .references(() => experiences.id, { onDelete: "restrict" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    during: tstzrange("during").generatedAlwaysAs(sql`tstzrange(starts_at, ends_at, '[)')`),
    capacity: smallint("capacity").notNull(),
    seatsBooked: smallint("seats_booked").notNull().default(0),
    /** Overrides the experience base price for this session. */
    priceOverride: money("price_override"),
    status: slotStatus("status").notNull().default("scheduled"),
    cancelledReason: text("cancelled_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("experience_slots_experience_start_key").on(t.experienceId, t.startsAt),
    index("experience_slots_starts_at_idx").on(t.startsAt),
    index("experience_slots_open_idx").on(t.startsAt).where(sql`status = 'scheduled'`),
    index("experience_slots_during_gist").using("gist", t.during),
    check("experience_slots_time_order", sql`${t.endsAt} > ${t.startsAt}`),
    check("experience_slots_capacity_range", sql`${t.capacity} between 1 and 500`),
    check("experience_slots_seats_within_capacity", sql`${t.seatsBooked} between 0 and ${t.capacity}`),
    check("experience_slots_price_override_non_negative", sql`${t.priceOverride} is null or ${t.priceOverride} >= 0`),
    check(
      "experience_slots_cancellation_reason",
      sql`${t.status} <> 'cancelled' or ${t.cancelledReason} is not null`,
    ),
  ],
);

/** Closures for one experience, or resort-wide when `experience_id` is NULL. */
export const blackoutPeriods = pgTable(
  "blackout_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    experienceId: uuid("experience_id").references(() => experiences.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    reason: text("reason").notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("blackout_periods_experience_start_idx").on(t.experienceId, t.startsAt),
    check("blackout_periods_time_order", sql`${t.endsAt} > ${t.startsAt}`),
    check("blackout_periods_reason_length", sql`char_length(${t.reason}) between 3 and 200`),
  ],
);
