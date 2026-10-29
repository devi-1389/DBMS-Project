import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, primaryKey, smallint, text, uuid } from "drizzle-orm/pg-core";

import { experienceCategories } from "./catalogue";
import { currencyCode, money, updatedAt } from "./columns";
import { difficulty, timeOfDay } from "./enums";
import { guestProfiles } from "./identity";

/** Interest tags shared by guests and experiences (matching input). */
export const interests = pgTable(
  "interests",
  {
    id: smallint("id").primaryKey().generatedAlwaysAsIdentity(),
    slug: text("slug").notNull().unique("interests_slug_key"),
    label: text("label").notNull(),
  },
  (t) => [
    check("interests_slug_format", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check("interests_label_length", sql`char_length(${t.label}) between 1 and 60`),
  ],
);

/** Scalar matching preferences, 1:1 with a guest. */
export const guestPreferences = pgTable(
  "guest_preferences",
  {
    guestId: uuid("guest_id")
      .primaryKey()
      .references(() => guestProfiles.userId, { onDelete: "cascade" }),
    maxDifficulty: difficulty("max_difficulty").notNull().default("moderate"),
    /** Per guest, per experience. NULL means no limit. */
    budgetPerGuest: money("budget_per_guest"),
    currency: currencyCode(),
    usualGroupSize: smallint("usual_group_size").notNull().default(2),
    needsStepFree: boolean("needs_step_free").notNull().default(false),
    notes: text("notes").notNull().default(""),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("guest_preferences_group_size_range", sql`${t.usualGroupSize} between 1 and 12`),
    check("guest_preferences_budget_non_negative", sql`${t.budgetPerGuest} is null or ${t.budgetPerGuest} >= 0`),
    check("guest_preferences_notes_length", sql`char_length(${t.notes}) <= 500`),
    check("guest_preferences_currency_format", sql`${t.currency} ~ '^[A-Z]{3}$'`),
  ],
);

/** Weighted interests per guest (M:N guest ↔ interest). */
export const guestInterests = pgTable(
  "guest_interests",
  {
    guestId: uuid("guest_id")
      .notNull()
      .references(() => guestProfiles.userId, { onDelete: "cascade" }),
    interestId: smallint("interest_id")
      .notNull()
      .references(() => interests.id, { onDelete: "restrict" }),
    weight: smallint("weight").notNull().default(3),
  },
  (t) => [
    primaryKey({ name: "guest_interests_pkey", columns: [t.guestId, t.interestId] }),
    index("guest_interests_interest_idx").on(t.interestId),
    check("guest_interests_weight_range", sql`${t.weight} between 1 and 5`),
  ],
);

/** Experience categories a guest loves, e.g. nature + adventure + luxury (M:N guest ↔ category). */
export const guestPreferredCategories = pgTable(
  "guest_preferred_categories",
  {
    guestId: uuid("guest_id")
      .notNull()
      .references(() => guestProfiles.userId, { onDelete: "cascade" }),
    categoryId: smallint("category_id")
      .notNull()
      .references(() => experienceCategories.id, { onDelete: "restrict" }),
  },
  (t) => [
    primaryKey({ name: "guest_preferred_categories_pkey", columns: [t.guestId, t.categoryId] }),
    index("guest_preferred_categories_category_idx").on(t.categoryId),
  ],
);

/** Preferred times of day per guest (multi-valued attribute, kept in 1NF). */
export const guestPreferredTimes = pgTable(
  "guest_preferred_times",
  {
    guestId: uuid("guest_id")
      .notNull()
      .references(() => guestProfiles.userId, { onDelete: "cascade" }),
    timeOfDay: timeOfDay("time_of_day").notNull(),
  },
  (t) => [primaryKey({ name: "guest_preferred_times_pkey", columns: [t.guestId, t.timeOfDay] })],
);
