import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { experiences, suppliers } from "./catalogue";
import { createdAt, updatedAt } from "./columns";
import { requirementBasis, resourceKind } from "./enums";

/** Bookable resources with a pooled quantity (6 canoes, 2 vans, 1 pavilion). */
export const resources = pgTable(
  "resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique("resources_name_key"),
    kind: resourceKind("kind").notNull(),
    quantityTotal: smallint("quantity_total").notNull(),
    location: text("location"),
    /** Set when the resource is rented from or operated by a supplier. */
    supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "restrict" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("resources_supplier_idx").on(t.supplierId),
    check("resources_name_length", sql`char_length(${t.name}) between 2 and 120`),
    check("resources_quantity_range", sql`${t.quantityTotal} between 1 and 10000`),
  ],
);

/** What each experience needs to run. */
export const experienceResourceRequirements = pgTable(
  "experience_resource_requirements",
  {
    experienceId: uuid("experience_id").notNull(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "restrict" }),
    basis: requirementBasis("basis").notNull().default("per_session"),
    quantity: smallint("quantity").notNull(),
  },
  (t) => [
    primaryKey({ name: "experience_resource_requirements_pkey", columns: [t.experienceId, t.resourceId] }),
    // Explicit name: the generated one exceeds PostgreSQL's 63-character limit.
    foreignKey({
      name: "experience_resource_requirements_experience_fk",
      columns: [t.experienceId],
      foreignColumns: [experiences.id],
    }).onDelete("cascade"),
    index("experience_resource_requirements_resource_idx").on(t.resourceId),
    check("experience_resource_requirements_quantity_positive", sql`${t.quantity} >= 1`),
  ],
);

/** Units out of service (repairs, servicing). Reduces what allocations can use. */
export const resourceMaintenance = pgTable(
  "resource_maintenance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    quantityOut: smallint("quantity_out").notNull().default(1),
    reason: text("reason").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("resource_maintenance_resource_start_idx").on(t.resourceId, t.startsAt),
    check("resource_maintenance_time_order", sql`${t.endsAt} > ${t.startsAt}`),
    check("resource_maintenance_quantity_positive", sql`${t.quantityOut} >= 1`),
    check("resource_maintenance_reason_length", sql`char_length(${t.reason}) between 3 and 200`),
  ],
);
