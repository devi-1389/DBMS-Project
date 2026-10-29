import { describe, expect, it } from "vitest";

import { parseFilters } from "@/lib/matching/filters";
import {
  recommendExperiences,
  suggestItinerary,
  type RecommendationFilters,
} from "@/lib/matching/recommend";
import type { ExperienceSlot, ExperienceSummary } from "@/lib/types/experience";
import type { GuestPreferences } from "@/lib/types/guest";

const NOW = new Date("2026-11-01T12:00:00.000Z");

function experience(slug: string, overrides: Partial<ExperienceSummary> = {}): ExperienceSummary {
  return {
    slug,
    title: slug,
    category: "nature",
    summary: "",
    description: "",
    highlights: [],
    interests: ["wildlife"],
    location: "",
    meetingPoint: "",
    accessible: true,
    durationMinutes: 120,
    difficulty: "easy",
    maxGroupSize: 8,
    minAge: 0,
    priceFromMinor: 5_000,
    currency: "USD",
    image: { src: "/x.jpg", alt: "" },
    featured: false,
    ...overrides,
  };
}

let nextId = 0;
function slot(experienceSlug: string, startsAt: string, overrides: Partial<ExperienceSlot> = {}): ExperienceSlot {
  const endsAt = new Date(Date.parse(startsAt) + 2 * 3_600_000).toISOString();
  return { id: `slot-${++nextId}`, experienceSlug, startsAt, endsAt, capacity: 8, booked: 0, ...overrides };
}

const preferences: GuestPreferences = {
  interests: ["wildlife", "water", "food"],
  interestWeights: { wildlife: 5, water: 4 },
  pace: "moderate",
  budgetMaxMinor: 20_000,
  groupSize: 2,
  timesOfDay: ["morning"],
  needsAccessibility: false,
  notes: "",
  updatedAt: null,
};

const filters: RecommendationFilters = {
  from: "2026-11-02",
  to: "2026-11-10",
  partySize: 2,
  maxPricePerGuestMinor: null,
  timesOfDay: [],
  availableOnly: true,
  avoidConflicts: true,
};

describe("recommendExperiences", () => {
  it("scores with named factors that add up to the shown score", () => {
    const canoe = experience("canoe", { interests: ["wildlife", "water"], difficulty: "moderate", priceFromMinor: 8_000 });
    const slots = ["2026-11-02", "2026-11-03", "2026-11-04"].map((day) => slot("canoe", `${day}T07:00:00.000Z`));
    const [match] = recommendExperiences({ experiences: [canoe], slots, preferences, filters, now: NOW }).recommendations;

    const points = Object.fromEntries(match.factors.map((factor) => [factor.key, [factor.points, factor.max]]));
    expect(points).toEqual({
      interests: [9, 9], // wildlife 5 + water 4, out of the two strongest weights
      pace: [2, 2], // exactly the preferred pace
      budget: [2, 2], // 80.00 is under half of 200.00
      timing: [2, 2], // morning session, morning preferred
      flexibility: [1, 1], // three sessions fit
    });
    expect(match.score).toBe(16);
    expect(match.maxScore).toBe(16);
    expect(match.percent).toBe(100);
    expect(match.reasons[0]).toBe("Matches your interest in wildlife and lakes & water");
  });

  it("ranks stronger matches first and explains weaker ones", () => {
    const strong = experience("strong", { interests: ["wildlife"], difficulty: "moderate" });
    const weak = experience("weak", { interests: ["craft"], priceFromMinor: 18_000 });
    const slots = [slot("strong", "2026-11-02T07:00:00.000Z"), slot("weak", "2026-11-02T14:00:00.000Z")];
    const { recommendations } = recommendExperiences({ experiences: [weak, strong], slots, preferences, filters, now: NOW });
    expect(recommendations.map((item) => item.experience.slug)).toEqual(["strong", "weak"]);
    const weakFactors = Object.fromEntries(recommendations[1].factors.map((factor) => [factor.key, factor]));
    expect(weakFactors.interests.points).toBe(0);
    expect(weakFactors.interests.detail).toBe("None of your interests");
    expect(weakFactors.pace.detail).toMatch(/gentler than your moderate limit/);
    expect(weakFactors.timing.detail).toBe("No session at your preferred times");
  });

  it("applies hard filters and counts why things were left out", () => {
    const experiences = [
      experience("steps", { accessible: false }),
      experience("hard", { difficulty: "challenging" }),
      experience("small", { maxGroupSize: 1 }),
      experience("pricey", { priceFromMinor: 30_000 }),
      experience("nothing-fits"),
      experience("ok"),
    ];
    const slots = experiences.map((item) => slot(item.slug, "2026-11-03T07:00:00.000Z"));
    slots.find((item) => item.experienceSlug === "nothing-fits")!.startsAt = "2026-12-20T07:00:00.000Z";

    const result = recommendExperiences({
      experiences,
      slots,
      preferences: { ...preferences, needsAccessibility: true },
      filters: { ...filters, maxPricePerGuestMinor: 20_000 },
      now: NOW,
    });
    expect(result.recommendations.map((item) => item.experience.slug)).toEqual(["ok"]);
    expect(result.excluded).toEqual({
      "step-free": 1,
      "too-challenging": 1,
      "group-too-large": 1,
      "over-budget": 1,
      "no-fitting-session": 1,
    });
  });

  it("filters sessions by date, seats, time of day, past times and plan conflicts", () => {
    const yoga = experience("yoga");
    const slots = [
      slot("yoga", "2026-11-01T07:00:00.000Z"), // already started
      slot("yoga", "2026-11-02T07:00:00.000Z", { booked: 7 }), // one seat left, party of two
      slot("yoga", "2026-11-03T07:00:00.000Z"), // clashes with the planned session
      slot("yoga", "2026-11-04T18:00:00.000Z"), // evening
      slot("yoga", "2026-11-05T07:00:00.000Z"), // fits
      slot("yoga", "2026-11-12T07:00:00.000Z"), // after the window
    ];
    const planned = [{ slotId: "other", startsAt: "2026-11-03T08:00:00.000Z", endsAt: "2026-11-03T09:00:00.000Z" }];
    const run = (overrides: Partial<RecommendationFilters>) =>
      recommendExperiences({ experiences: [yoga], slots, preferences, filters: { ...filters, ...overrides }, planned, now: NOW })
        .recommendations[0]?.sessions.map((item) => item.startsAt.slice(0, 10)) ?? [];

    expect(run({ timesOfDay: ["morning"] })).toEqual(["2026-11-05"]);
    expect(run({})).toEqual(["2026-11-04", "2026-11-05"]);
    expect(run({ availableOnly: false, avoidConflicts: false })).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"]);
    expect(run({ from: "2026-11-06", to: "2026-11-10" })).toEqual([]);
  });

  it("treats a missing interest weight as the default", () => {
    const dinner = experience("dinner", { interests: ["food"] });
    const [match] = recommendExperiences({
      experiences: [dinner],
      slots: [slot("dinner", "2026-11-02T18:00:00.000Z")],
      preferences,
      filters,
      now: NOW,
    }).recommendations;
    expect(match.factors.find((factor) => factor.key === "interests")?.points).toBe(3);
  });
});

describe("suggestItinerary", () => {
  it("picks non-overlapping sessions, at most two per day, and leaves the plan alone", () => {
    // Ranked a > b > c: a shares more interests, b has a morning session, c doesn't.
    const a = experience("a", { interests: ["wildlife", "water"] });
    const b = experience("b");
    const c = experience("c");
    const slots = [
      slot("a", "2026-11-02T07:00:00.000Z"),
      slot("b", "2026-11-02T08:00:00.000Z"), // overlaps a
      slot("b", "2026-11-02T14:00:00.000Z"),
      slot("c", "2026-11-02T18:00:00.000Z"), // third on the same day
      slot("c", "2026-11-03T18:00:00.000Z"),
    ];
    const planned: { slotId: string; startsAt: string; endsAt: string }[] = [];
    const { recommendations } = recommendExperiences({ experiences: [a, b, c], slots, preferences, filters, planned, now: NOW });
    const suggestion = suggestItinerary({ recommendations, planned });
    expect(suggestion.map((item) => `${item.recommendation.experience.slug} ${item.slot.startsAt.slice(5, 16)}`)).toEqual([
      "a 11-02T07:00",
      "b 11-02T14:00",
      "c 11-03T18:00",
    ]);
    expect(planned).toEqual([]);
  });
});

describe("parseFilters", () => {
  const defaults: RecommendationFilters = { ...filters, maxPricePerGuestMinor: 20_000 };

  it("reads valid params", () => {
    expect(
      parseFilters(
        { from: "2026-11-03", to: "2026-11-05", party: "4", budget: "any", times: ["morning", "evening"], available: "0", conflicts: "0" },
        defaults,
      ),
    ).toEqual({
      from: "2026-11-03",
      to: "2026-11-05",
      partySize: 4,
      maxPricePerGuestMinor: null,
      timesOfDay: ["morning", "evening"],
      availableOnly: false,
      avoidConflicts: false,
    });
  });

  it("falls back to defaults for junk and keeps the window ordered and bounded", () => {
    const parsed = parseFilters({ from: "2026-02-30", to: "nope", party: "99", budget: "123", times: "noon" }, defaults);
    expect(parsed).toMatchObject({ from: defaults.from, to: defaults.to, partySize: 2, maxPricePerGuestMinor: 20_000, timesOfDay: [] });
    expect(parseFilters({ from: "2026-11-09", to: "2026-11-02" }, defaults).to).toBe("2026-11-09");
    expect(parseFilters({ from: "2026-11-01", to: "2027-06-01" }, defaults).to).toBe("2026-12-31");
  });
});
