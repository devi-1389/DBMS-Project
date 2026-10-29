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
