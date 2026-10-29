import { describe, expect, it } from "vitest";

import { resortTime, timeOfDay, toDateKey } from "@/lib/format";
import { parseFilters } from "@/lib/matching/filters";
import {
  recommendExperiences,
  suggestItinerary,
  type RecommendationFilters,
} from "@/lib/matching/recommend";
import type { ExperienceSlot, ExperienceSummary, SlotReadiness } from "@/lib/types/experience";
import type { GuestPreferences } from "@/lib/types/guest";

const at = (day: string, time: string) => resortTime(day, time).toISOString();
const NOW = new Date(at("2026-11-01", "12:00"));

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
    currency: "INR",
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
  categories: [],
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
    const slots = ["2026-11-02", "2026-11-03", "2026-11-04"].map((day) => slot("canoe", at(day, "07:00")));
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
    const slots = [slot("strong", at("2026-11-02", "07:00")), slot("weak", at("2026-11-02", "14:00"))];
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
    const slots = experiences.map((item) => slot(item.slug, at("2026-11-03", "07:00")));
    slots.find((item) => item.experienceSlug === "nothing-fits")!.startsAt = at("2026-12-20", "07:00");

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
      slot("yoga", at("2026-11-01", "07:00")), // already started
      slot("yoga", at("2026-11-02", "07:00"), { booked: 7 }), // one seat left, party of two
      slot("yoga", at("2026-11-03", "07:00")), // clashes with the planned session
      slot("yoga", at("2026-11-04", "18:00")), // evening
      slot("yoga", at("2026-11-05", "07:00")), // fits
      slot("yoga", at("2026-11-12", "07:00")), // after the window
    ];
    const planned = [{ slotId: "other", startsAt: at("2026-11-03", "08:00"), endsAt: at("2026-11-03", "09:00") }];
    const run = (overrides: Partial<RecommendationFilters>) =>
      recommendExperiences({ experiences: [yoga], slots, preferences, filters: { ...filters, ...overrides }, planned, now: NOW })
        .recommendations[0]?.sessions.map((item) => toDateKey(item.startsAt)) ?? [];

    expect(run({ timesOfDay: ["morning"] })).toEqual(["2026-11-05"]);
    expect(run({})).toEqual(["2026-11-04", "2026-11-05"]);
    expect(run({ availableOnly: false, avoidConflicts: false })).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"]);
    expect(run({ from: "2026-11-06", to: "2026-11-10" })).toEqual([]);
  });

  it("treats a missing interest weight as the default", () => {
    const dinner = experience("dinner", { interests: ["food"] });
    const [match] = recommendExperiences({
      experiences: [dinner],
      slots: [slot("dinner", at("2026-11-02", "18:00"))],
      preferences,
      filters,
      now: NOW,
    }).recommendations;
    expect(match.factors.find((factor) => factor.key === "interests")?.points).toBe(3);
  });
});

describe("availability (staff, venues and shared equipment)", () => {
  const ready = (overrides: Partial<SlotReadiness> = {}): SlotReadiness => ({
    ready: true,
    staff: ["Ravi Kumar"],
    resources: ["Single kayak"],
    missing: [],
    bookableSeats: 8,
    limitedBy: null,
    ...overrides,
  });
  const kayak = experience("kayak", { interests: ["water"] });

  it("never suggests a session that can't run, and says why it was left out", () => {
    const slots = [
      slot("kayak", at("2026-11-03", "07:30"), { readiness: ready({ ready: false, staff: [], bookableSeats: 0 }) }),
      slot("kayak", at("2026-11-04", "07:30"), { readiness: ready({ ready: false, missing: ["Single kayak"], bookableSeats: 0 }) }),
    ];
    const result = recommendExperiences({ experiences: [kayak], slots, preferences, filters, now: NOW });
    expect(result.recommendations).toEqual([]);
    expect(result.excluded).toEqual({ "not-ready": 1 });
  });

  it("caps places by shared equipment, not just seats", () => {
    const slots = [
      slot("kayak", at("2026-11-03", "07:30"), { readiness: ready({ bookableSeats: 1, limitedBy: "Single kayak" }) }),
      slot("kayak", at("2026-11-04", "07:30"), { readiness: ready() }),
    ];
    const [match] = recommendExperiences({ experiences: [kayak], slots, preferences, filters, now: NOW }).recommendations;
    expect(match.sessions.map((item) => toDateKey(item.startsAt))).toEqual(["2026-11-04"]);
    expect(match.availability).toBe("Ravi Kumar leads · Single kayak confirmed");
    expect(match.reasons.at(-1)).toBe(match.availability);
  });
});

describe("favourite categories", () => {
  it("scores experiences in the guest's favourite categories higher", () => {
    const spa = experience("spa", { category: "wellness", interests: ["mindfulness"] });
    const dinner = experience("dinner", { category: "luxury", interests: ["mindfulness"] });
    const slots = [slot("spa", at("2026-11-02", "10:00")), slot("dinner", at("2026-11-02", "18:00"))];
    const { recommendations } = recommendExperiences({
      experiences: [spa, dinner],
      slots,
      preferences: { ...preferences, interests: ["mindfulness"], categories: ["nature", "adventure", "luxury"], timesOfDay: [] },
      filters,
      now: NOW,
    });
    expect(recommendations.map((item) => item.experience.slug)).toEqual(["dinner", "spa"]);
    const factor = (slug: string) => recommendations.find((item) => item.experience.slug === slug)!.factors.find((f) => f.key === "categories");
    expect(factor("dinner")).toMatchObject({ points: 3, max: 3, detail: "Luxury, one of your favourites" });
    expect(factor("spa")).toMatchObject({ points: 0, detail: "Not in your favourites (nature, adventure and luxury)" });
  });
});

describe("day-by-day planner", () => {
  const days = ["2026-11-02", "2026-11-03", "2026-11-04"];
  const catalogue = [
    experience("spa", { category: "wellness", priceFromMinor: 450_000 }),
    experience("dinner", { category: "luxury", priceFromMinor: 550_000 }),
    experience("kayak", { category: "adventure", priceFromMinor: 160_000 }),
    experience("trek", { category: "nature", priceFromMinor: 120_000 }),
  ];
  const slots = days.flatMap((day) => [
    slot("spa", at(day, "14:00")),
    slot("dinner", at(day, "18:00")),
    slot("kayak", at(day, "07:30")),
    slot("kayak", at(day, "15:30")),
    slot("trek", at(day, "08:00")),
  ]);
  const rank = (budgetMinor: number | null) => {
    const { recommendations } = recommendExperiences({ experiences: catalogue, slots, preferences, filters, now: NOW, limit: 10 });
    // These fixtures score low on purpose; match quality is covered separately below.
    return suggestItinerary({ recommendations, days, perDay: 2, partySize: 1, budgetMinor, preferredTimes: ["morning"], minPercent: 0 });
  };

  it("spreads matches across the stay's days and prefers the guest's times", () => {
    const plan = rank(null);
    const perDay = new Map<string, number>();
    for (const item of plan.sessions) perDay.set(toDateKey(item.slot.startsAt), (perDay.get(toDateKey(item.slot.startsAt)) ?? 0) + 1);
    expect([...perDay.keys()].sort()).toEqual(days);
    expect(Math.max(...perDay.values())).toBeLessThanOrEqual(2);
    const kayak = plan.sessions.find((item) => item.recommendation.experience.slug === "kayak")!;
    expect(timeOfDay(kayak.slot.startsAt)).toBe("morning");
  });

  it("doesn't spend the budget on weak matches", () => {
    const { recommendations } = recommendExperiences({ experiences: catalogue, slots, preferences, filters, now: NOW, limit: 10 });
    const weak = recommendations.map((item) => ({ ...item, percent: 40 }));
    expect(suggestItinerary({ recommendations: weak, days }).sessions).toEqual([]);
    expect(suggestItinerary({ recommendations: weak, days, minPercent: 0 }).sessions.length).toBeGreaterThan(0);
  });

  it("stays within the activity budget and reports what it left out", () => {
    const plan = rank(700_000); // ₹7,000
    expect(plan.totalMinor).toBeLessThanOrEqual(700_000);
    expect(plan.remainingMinor).toBe(700_000 - plan.totalMinor);
    expect(plan.skippedForBudget).toBeGreaterThan(0);
    expect(plan.sessions.every((item) => item.costMinor === item.recommendation.experience.priceFromMinor)).toBe(true);
  });
});

describe("suggestItinerary", () => {
  it("picks non-overlapping sessions, at most two per day, and leaves the plan alone", () => {
    // Ranked a > b > c: a shares more interests, b has a morning session, c doesn't.
    const a = experience("a", { interests: ["wildlife", "water"] });
    const b = experience("b");
    const c = experience("c");
    const slots = [
      slot("a", at("2026-11-02", "07:00")),
      slot("b", at("2026-11-02", "08:00")), // overlaps a
      slot("b", at("2026-11-02", "14:00")),
      slot("c", at("2026-11-02", "18:00")), // third on the same day
      slot("c", at("2026-11-03", "18:00")),
    ];
    const planned: { slotId: string; startsAt: string; endsAt: string }[] = [];
    const { recommendations } = recommendExperiences({ experiences: [a, b, c], slots, preferences, filters, planned, now: NOW });
    const suggestion = suggestItinerary({ recommendations, planned });
    expect(suggestion.sessions.map((item) => `${item.recommendation.experience.slug} ${item.slot.startsAt}`)).toEqual([
      `a ${at("2026-11-02", "07:00")}`,
      `b ${at("2026-11-02", "14:00")}`,
      `c ${at("2026-11-03", "18:00")}`,
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
