import { sql } from "drizzle-orm";
import { check, index, pgTable, smallint, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { bookings } from "./bookings";
import { experienceSlots } from "./catalogue";
import { allocationStatus, assignmentRole, assignmentStatus } from "./enums";
import { staffMembers } from "./identity";
import { resources } from "./resources";

/**
 * Staff on a slot. The trigger locks the staff row and rejects overlapping
 * active assignments, so one person can't be in two places at once.
 */
export const staffAssignments = pgTable(
  "staff_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slotId: uuid("slot_id")
      .notNull()
      .references(() => experienceSlots.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staffMembers.id, { onDelete: "restrict" }),
    role: assignmentRole("role").notNull().default("lead"),
    status: assignmentStatus("status").notNull().default("assigned"),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("staff_assignments_slot_staff_key").on(t.slotId, t.staffId),
    uniqueIndex("staff_assignments_one_lead_per_slot")
      .on(t.slotId)
      .where(sql`role = 'lead' and status = 'assigned'`),
    index("staff_assignments_staff_idx").on(t.staffId),
  ],
);

/**
 * Units of a resource held for a slot (session-level, `booking_id` NULL) or for one
 * booking (per-guest equipment). The trigger locks the resource row and rejects
 * allocations that exceed the units free after other allocations and maintenance.
 */
export const resourceAllocations = pgTable(
  "resource_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "restrict" }),
    slotId: uuid("slot_id")
      .notNull()
      .references(() => experienceSlots.id, { onDelete: "cascade" }),
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "cascade" }),
    quantity: smallint("quantity").notNull(),
    status: allocationStatus("status").notNull().default("held"),
    allocatedAt: timestamp("allocated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("resource_allocations_resource_idx").on(t.resourceId),
    index("resource_allocations_slot_idx").on(t.slotId),
    index("resource_allocations_booking_idx").on(t.bookingId),
    uniqueIndex("resource_allocations_one_session_hold")
      .on(t.resourceId, t.slotId)
      .where(sql`booking_id is null and status = 'held'`),
    check("resource_allocations_quantity_positive", sql`${t.quantity} >= 1`),
  ],
);
