import { char, customType, numeric, timestamp } from "drizzle-orm/pg-core";

/** PostgreSQL `tstzrange`, read as its text form, e.g. `["2026-11-02 06:30:00+00","2026-11-02 09:00:00+00")`. */
export const tstzrange = customType<{ data: string }>({
  dataType() {
    return "tstzrange";
  },
});

/** Prices per guest: exact decimal, never floating point. Drizzle returns these as strings. */
export const money = (name: string) => numeric(name, { precision: 10, scale: 2 });

/** Totals and payment amounts (larger range than per-guest prices). */
export const moneyTotal = (name: string) => numeric(name, { precision: 12, scale: 2 });

export const currencyCode = () => char("currency", { length: 3 }).notNull().default("USD");

export const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/** Kept current by the `set_updated_at` trigger (drizzle/0001_integrity.sql). */
export const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
