import { describe, expect, it } from "vitest";

import {
  addSessionSchema,
  planSchema,
  preferencesSchema,
  roleChangeSchema,
  toFieldErrors,
} from "@/lib/validation/schemas";

const validPreferences = {
  interests: ["wildlife", "water"],
  interestWeights: { wildlife: 5 },
  pace: "moderate",
  budgetMaxMinor: 20_000,
  groupSize: 2,
  timesOfDay: ["morning"],
  needsAccessibility: false,
  notes: "  Anniversary  ",
};

describe("preferences schema", () => {
  it("accepts a complete form and trims notes", () => {
    const parsed = preferencesSchema.parse(validPreferences);
    expect(parsed.notes).toBe("Anniversary");
    expect(parsed.interestWeights).toEqual({ wildlife: 5 });
  });

  it("rejects smuggled permission fields instead of ignoring them", () => {
    for (const extra of [{ role: "admin" }, { isAdmin: true }, { userId: "someone-else" }]) {
      const result = preferencesSchema.safeParse({ ...validPreferences, ...extra });
      expect(result.success).toBe(false);
      if (!result.success) expect(toFieldErrors(result.error).formError).toMatch(/unrecognized key/i);
    }
  });

  it("explains each invalid field", () => {
    const result = preferencesSchema.safeParse({
      ...validPreferences,
      interests: [],
      groupSize: 40,
      budgetMaxMinor: -1,
      interestWeights: { wildlife: 9 },
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const { fieldErrors } = toFieldErrors(result.error);
    expect(fieldErrors.interests).toBe("Choose at least one interest.");
    expect(fieldErrors.groupSize).toMatch(/at most 12/);
    expect(fieldErrors.budgetMaxMinor).toBe("Budget can't be negative.");
    expect(fieldErrors.interestWeights).toBeDefined();
  });

  it("rejects unknown interests and paces", () => {
    expect(preferencesSchema.safeParse({ ...validPreferences, interests: ["skydiving"] }).success).toBe(false);
    expect(preferencesSchema.safeParse({ ...validPreferences, pace: "extreme" }).success).toBe(false);
  });
});

describe("plan schema", () => {
  it("accepts open-ended and dated stays", () => {
    expect(planSchema.safeParse({ name: "Autumn", arrival: null, departure: null }).success).toBe(true);
    expect(planSchema.safeParse({ name: "Autumn", arrival: "2026-11-02", departure: "2026-11-06" }).success).toBe(true);
  });

  it("rejects backwards, impossible and overlong stays", () => {
    const backwards = planSchema.safeParse({ name: "A", arrival: "2026-11-06", departure: "2026-11-02" });
    expect(backwards.success || toFieldErrors(backwards.error).fieldErrors.departure).toBe(
      "Departure must be on or after arrival.",
    );
    expect(planSchema.safeParse({ name: "A", arrival: "2026-02-30", departure: null }).success).toBe(false);
    expect(planSchema.safeParse({ name: "A", arrival: "2026-11-01", departure: "2026-12-15" }).success).toBe(false);
    expect(planSchema.safeParse({ name: "   ", arrival: null, departure: null }).success).toBe(false);
  });
});

describe("SOLACE additions", () => {
  it("accepts favourite categories and rejects unknown ones", () => {
    expect(preferencesSchema.parse({ ...validPreferences, categories: ["nature", "adventure", "luxury"] }).categories).toEqual([
      "nature",
      "adventure",
      "luxury",
    ]);
    expect(preferencesSchema.parse(validPreferences).categories).toEqual([]);
    expect(preferencesSchema.safeParse({ ...validPreferences, categories: ["casino"] }).success).toBe(false);
  });

  it("validates a plan's activity budget in paise", () => {
    const plan = { name: "Long weekend", arrival: "2026-11-02", departure: "2026-11-04" };
    expect(planSchema.parse({ ...plan, activityBudgetMinor: 1_500_000 }).activityBudgetMinor).toBe(1_500_000);
    expect(planSchema.parse(plan).activityBudgetMinor).toBeNull();
    const negative = planSchema.safeParse({ ...plan, activityBudgetMinor: -100 });
    expect(negative.success || toFieldErrors(negative.error).fieldErrors.activityBudgetMinor).toBe("Budget can't be negative.");
    const huge = planSchema.safeParse({ ...plan, activityBudgetMinor: 60_000_000 });
    expect(huge.success || toFieldErrors(huge.error).fieldErrors.activityBudgetMinor).toBe("Budget can be at most ₹5,00,000.");
    expect(planSchema.safeParse({ ...plan, activityBudgetMinor: Number.NaN }).success).toBe(false);
  });
});

describe("session and role schemas", () => {
  it("requires a real slug, ISO time and sane party size", () => {
    const base = { experienceSlug: "lakeside-sunrise-yoga", startsAt: "2026-11-03T07:00:00.000Z", partySize: 2 };
    expect(addSessionSchema.safeParse(base).success).toBe(true);
    expect(addSessionSchema.safeParse({ ...base, experienceSlug: "../admin" }).success).toBe(false);
    expect(addSessionSchema.safeParse({ ...base, startsAt: "tomorrow" }).success).toBe(false);
    expect(addSessionSchema.safeParse({ ...base, partySize: 0 }).success).toBe(false);
    expect(addSessionSchema.safeParse({ ...base, partySize: 2.5 }).success).toBe(false);
    expect(addSessionSchema.safeParse({ ...base, priceMinor: 0 }).success).toBe(false);
  });

  it("only accepts known roles", () => {
    const userId = "6f1c1d1e-8a0b-4c4e-9d55-3c5d3f2b1a10";
    expect(roleChangeSchema.safeParse({ userId, role: "staff" }).success).toBe(true);
    expect(roleChangeSchema.safeParse({ userId, role: "owner" }).success).toBe(false);
    expect(roleChangeSchema.safeParse({ userId: "1", role: "staff" }).success).toBe(false);
  });
});
