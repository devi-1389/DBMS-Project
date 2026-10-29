import { sql } from "drizzle-orm";
import { boolean, check, date, pgTable, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { createdAt, updatedAt } from "./columns";
import { authProvider, userRole } from "./enums";

/** One row per person who can sign in. The role is the source of truth for authorization. */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    role: userRole("role").notNull().default("guest"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("users_email_lower_key").on(sql`lower(${t.email})`),
    check("users_email_format", sql`${t.email} ~* '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$'`),
    check("users_display_name_length", sql`char_length(${t.displayName}) between 1 and 120`),
  ],
);

/** Authentication-provider identities (Clerk user IDs). A user may link one identity per provider. */
export const authIdentities = pgTable(
  "auth_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: authProvider("provider").notNull(),
    providerUserId: text("provider_user_id").notNull(),
    createdAt: createdAt(),
    lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
  },
  (t) => [
    unique("auth_identities_provider_user_key").on(t.provider, t.providerUserId),
    unique("auth_identities_user_provider_key").on(t.userId, t.provider),
    check("auth_identities_provider_user_id_length", sql`char_length(${t.providerUserId}) between 1 and 255`),
  ],
);

/** Guest profile, 1:1 with users (shared primary key). */
export const guestProfiles = pgTable(
  "guest_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    phone: text("phone"),
    dateOfBirth: date("date_of_birth"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "guest_profiles_name_length",
      sql`char_length(${t.firstName}) between 1 and 80 and char_length(${t.lastName}) between 1 and 80`,
    ),
    check("guest_profiles_phone_format", sql`${t.phone} is null or ${t.phone} ~ '^\\+?[0-9 ()-]{6,20}$'`),
    check("guest_profiles_birth_date_range", sql`${t.dateOfBirth} is null or ${t.dateOfBirth} > date '1900-01-01'`),
  ],
);

/** Resort staff. A staff member may optionally have a sign-in account. */
export const staffMembers = pgTable(
  "staff_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .unique("staff_members_user_key")
      .references(() => users.id, { onDelete: "set null" }),
    displayName: text("display_name").notNull(),
    jobTitle: text("job_title").notNull(),
    email: text("email"),
    isActive: boolean("is_active").notNull().default(true),
    hiredOn: date("hired_on"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("staff_members_display_name_length", sql`char_length(${t.displayName}) between 1 and 120`),
    check("staff_members_job_title_length", sql`char_length(${t.jobTitle}) between 1 and 120`),
    check(
      "staff_members_email_format",
      sql`${t.email} is null or ${t.email} ~* '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$'`,
    ),
  ],
);
