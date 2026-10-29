// LUXE-ECO explainable recommendations: hard filters first (each with a stated reason),
// then a score made of named factors so guests can see exactly why something ranked
// where it did. Sessions must also be able to run: a guide assigned and the venue and
// equipment available (from the `slot_readiness` view). Pure: the same code ranks
// database records on the server and previews on the client.
import { CATEGORY_LABELS, type ExperienceCategory } from "@/lib/categories";
import { DIFFICULTY_LABELS, DIFFICULTY_RANK } from "@/lib/difficulty";
import { formatDate, formatPrice, formatTime, joinList, timeOfDay, toDateKey } from "@/lib/format";
import { INTEREST_LABELS, type InterestId } from "@/lib/interests";
import { overlaps } from "@/lib/itinerary";
import type { ExperienceSlot, ExperienceSummary } from "@/lib/types/experience";
import type { GuestPreferences, TimeOfDay } from "@/lib/types/guest";

export const DEFAULT_INTEREST_WEIGHT = 3;

export type RecommendationFilters = {
  /** Inclusive resort-local date keys. */
  from: string;
  to: string;
  partySize: number;
  /** Hard price cap per guest; null = no cap. */
  maxPricePerGuestMinor: number | null;
  /** Only sessions at these times of day; empty = any time. */
  timesOfDay: TimeOfDay[];
  /** Only sessions with enough seats (and shared equipment) left for the party. */
  availableOnly: boolean;
  /** Skip sessions that overlap something already planned. */
  avoidConflicts: boolean;
};

export type PlannedSession = { slotId: string; startsAt: string; endsAt: string };

export type FactorKey = "interests" | "categories" | "pace" | "budget" | "timing" | "flexibility";

export type ScoreFactor = { key: FactorKey; label: string; points: number; max: number; detail: string };

export type Recommendation = {
  experience: ExperienceSummary;
  score: number;
  maxScore: number;
  /** score / maxScore, 0–100. */
  percent: number;
  factors: ScoreFactor[];
  reasons: string[];
  /** Sessions that pass every filter and can run, soonest first. */
  sessions: ExperienceSlot[];
  fittingSessionCount: number;
  /** What was checked for the first session: who leads it and which resources are held. */
  availability: string | null;
};

export type ExclusionReason =
  | "step-free"
  | "too-challenging"
  | "group-too-large"
  | "over-budget"
  | "not-ready"
  | "no-fitting-session";

export const EXCLUSION_LABELS: Record<ExclusionReason, string> = {
  "step-free": "need step-free access you asked for",
  "too-challenging": "are harder than your chosen pace",
  "group-too-large": "can't take a group of this size",
  "over-budget": "cost more than your budget",
  "not-ready": "have no session with a guide, venue and equipment free for your group",
  "no-fitting-session": "have no session that fits your dates, party size or schedule",
};

export type RecommendationResult = {
  recommendations: Recommendation[];
  excluded: Partial<Record<ExclusionReason, number>>;
};

/** Seats a new party can use: seats left, capped by shared equipment pools when known. */
export function bookableSeats(slot: ExperienceSlot) {
  return slot.readiness?.bookableSeats ?? slot.capacity - slot.booked;
}

/** Guide or host assigned and every per-session resource held. Placeholder sessions count as ready. */
export function isReady(slot: ExperienceSlot) {
  return slot.readiness?.ready ?? true;
}

/** "Mara Ellis leads · Two-person canoe and Wildlife binoculars confirmed". */
export function describeAvailability(slot: ExperienceSlot) {
  const readiness = slot.readiness;
  if (!readiness?.ready) return null;
  const parts = [`${joinList(readiness.staff)} ${readiness.staff.length > 1 ? "lead" : "leads"}`];
  if (readiness.resources.length) parts.push(`${joinList(readiness.resources)} confirmed`);
  if (readiness.limitedBy) parts.push(`${readiness.bookableSeats} places left (${readiness.limitedBy} is shared)`);
  return parts.join(" · ");
}

function weightOf(preferences: GuestPreferences, interest: InterestId) {
  return preferences.interestWeights[interest] ?? DEFAULT_INTEREST_WEIGHT;
}

function fittingSessions(slots: ExperienceSlot[], filters: RecommendationFilters, planned: PlannedSession[], now: Date) {
  let blockedByReadiness = 0;
  const sessions = slots
    .filter((slot) => {
      if (Date.parse(slot.startsAt) <= now.getTime()) return false;
      const day = toDateKey(slot.startsAt);
      if (day < filters.from || day > filters.to) return false;
      if (filters.timesOfDay.length && !filters.timesOfDay.includes(timeOfDay(slot.startsAt))) return false;
      if (planned.some((item) => item.slotId === slot.id)) return false;
      if (filters.avoidConflicts && planned.some((item) => overlaps(item, slot))) return false;
      // No guide assigned, or its venue, boats or vehicle aren't held: it can't run.
      if (!isReady(slot)) {
        blockedByReadiness++;
        return false;
      }
      if (filters.availableOnly) {
        if (slot.capacity - slot.booked < filters.partySize) return false;
        // Seats are free, but a shared equipment pool (kayaks, bicycles…) is short.
        if (bookableSeats(slot) < filters.partySize) {
          blockedByReadiness++;
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return { sessions, blockedByReadiness };
}

function scoreFactors(
  experience: ExperienceSummary,
  sessions: ExperienceSlot[],
  preferences: GuestPreferences,
): ScoreFactor[] {
  const factors: ScoreFactor[] = [];

  // Interests: sum of the guest's weights for interests the experience shares.
  const weights = preferences.interests.map((interest) => weightOf(preferences, interest)).sort((a, b) => b - a);
  const interestMax = weights.slice(0, 2).reduce((sum, weight) => sum + weight, 0);
  if (interestMax > 0) {
    const shared = experience.interests.filter((interest) => preferences.interests.includes(interest));
    factors.push({
      key: "interests",
      label: "Shared interests",
      points: Math.min(
        interestMax,
        shared.reduce((sum, interest) => sum + weightOf(preferences, interest), 0),
      ),
      max: interestMax,
      detail: shared.length
        ? joinList(shared.map((interest) => INTEREST_LABELS[interest]))
        : "None of your interests",
    });
  }

  // Favourite categories, e.g. "nature + adventure + luxury".
  if (preferences.categories.length) {
    const favourite = preferences.categories.includes(experience.category);
    factors.push({
      key: "categories",
      label: "Favourite categories",
      points: favourite ? 3 : 0,
      max: 3,
      detail: favourite
        ? `${CATEGORY_LABELS[experience.category]}, one of your favourites`
        : `Not in your favourites (${joinList(preferences.categories.map((category) => CATEGORY_LABELS[category].toLowerCase()))})`,
    });
  }

  // Pace: an exact match beats something gentler (harder ones are filtered out).
  const sameDifficulty = experience.difficulty === preferences.pace;
  factors.push({
    key: "pace",
    label: "Pace",
    points: sameDifficulty ? 2 : 1,
    max: 2,
    detail: sameDifficulty
      ? `${DIFFICULTY_LABELS[experience.difficulty]}, your preferred pace`
      : `${DIFFICULTY_LABELS[experience.difficulty]}, gentler than your ${DIFFICULTY_LABELS[preferences.pace].toLowerCase()} limit`,
  });

  // Budget from preferences (soft): comfortably within scores higher.
  const budget = preferences.budgetMaxMinor;
  if (budget !== null) {
    const price = experience.priceFromMinor;
    const points = price <= budget / 2 ? 2 : price <= budget ? 1 : 0;
    factors.push({
      key: "budget",
      label: "Budget",
      points,
      max: 2,
      detail:
        price === 0
          ? "Complimentary"
          : `${formatPrice(price, experience.currency)} of your ${formatPrice(budget, experience.currency)} per guest`,
    });
  }

  // Timing: a fitting session at one of the guest's preferred times of day.
  if (preferences.timesOfDay.length) {
    const match = sessions.find((slot) => preferences.timesOfDay.includes(timeOfDay(slot.startsAt)));
    factors.push({
      key: "timing",
      label: "Time of day",
      points: match ? 2 : 0,
      max: 2,
      detail: match
        ? `${formatDate(match.startsAt)} at ${formatTime(match.startsAt)} suits your schedule`
        : "No session at your preferred times",
    });
  }

  // Flexibility: several sessions to choose from.
  factors.push({
    key: "flexibility",
    label: "Choice of sessions",
    points: sessions.length >= 3 ? 1 : 0,
    max: 1,
    detail: `${sessions.length} session${sessions.length === 1 ? "" : "s"} fit${sessions.length === 1 ? "s" : ""} your filters`,
  });

  return factors;
}

function reasonsFrom(factors: ScoreFactor[]) {
  return factors
    .filter((factor) => factor.points > 0)
    .sort((a, b) => b.points - a.points)
    .map((factor) =>
      factor.key === "interests" ? `Matches your interest in ${factor.detail.toLowerCase()}` : factor.detail,
    );
}

export function recommendExperiences({
  experiences,
  slots,
  preferences,
  filters,
  planned = [],
  now = new Date(),
  limit = 6,
}: {
  experiences: ExperienceSummary[];
  slots: ExperienceSlot[];
  preferences: GuestPreferences;
  filters: RecommendationFilters;
  planned?: PlannedSession[];
  now?: Date;
  limit?: number;
}): RecommendationResult {
  const excluded: Partial<Record<ExclusionReason, number>> = {};
  const exclude = (reason: ExclusionReason) => {
    excluded[reason] = (excluded[reason] ?? 0) + 1;
  };
  const slotsBySlug = new Map<string, ExperienceSlot[]>();
  for (const slot of slots) {
    slotsBySlug.set(slot.experienceSlug, [...(slotsBySlug.get(slot.experienceSlug) ?? []), slot]);
  }

  const recommendations: Recommendation[] = [];
  for (const experience of experiences) {
    if (preferences.needsAccessibility && !experience.accessible) {
      exclude("step-free");
      continue;
    }
    if (DIFFICULTY_RANK[experience.difficulty] > DIFFICULTY_RANK[preferences.pace]) {
      exclude("too-challenging");
      continue;
    }
    if (filters.partySize > experience.maxGroupSize) {
      exclude("group-too-large");
      continue;
    }
    if (filters.maxPricePerGuestMinor !== null && experience.priceFromMinor > filters.maxPricePerGuestMinor) {
      exclude("over-budget");
      continue;
    }
    const { sessions, blockedByReadiness } = fittingSessions(slotsBySlug.get(experience.slug) ?? [], filters, planned, now);
    if (!sessions.length) {
      exclude(blockedByReadiness ? "not-ready" : "no-fitting-session");
      continue;
    }

    const factors = scoreFactors(experience, sessions, preferences);
    const score = factors.reduce((sum, factor) => sum + factor.points, 0);
    const maxScore = factors.reduce((sum, factor) => sum + factor.max, 0);
    const availability = describeAvailability(sessions[0]);
    recommendations.push({
      experience,
      score,
      maxScore,
      percent: maxScore ? Math.round((score / maxScore) * 100) : 0,
      factors,
      reasons: [...reasonsFrom(factors), ...(availability ? [availability] : [])],
      sessions,
      fittingSessionCount: sessions.length,
      availability,
    });
  }

  recommendations.sort(
    (a, b) =>
      b.percent - a.percent ||
      b.score - a.score ||
      b.fittingSessionCount - a.fittingSessionCount ||
      a.experience.priceFromMinor - b.experience.priceFromMinor ||
      a.experience.title.localeCompare(b.experience.title),
  );

  return { recommendations: recommendations.slice(0, limit), excluded };
}

export type SuggestedSession = { recommendation: Recommendation; slot: ExperienceSlot; costMinor: number };

export type SuggestedItinerary = {
  sessions: SuggestedSession[];
  /** Estimated cost of the suggested sessions for the whole party. */
  totalMinor: number;
  /** Budget left after the plan's existing items and these suggestions; null = no budget. */
  remainingMinor: number | null;
  /** Good matches left out because they'd go over the budget. */
  skippedForBudget: number;
};

/**
 * A suggested day-by-day itinerary (the brief's "Day 1: spa + private dinner…"): the best
 * recommendations placed on sessions that can run, spread across the stay's days, at most
 * `perDay` a day, never overlapping each other or the plan, preferring the guest's times of
 * day, and within the remaining activity budget. Matches under `minPercent` are skipped.
 * Nothing is saved or reserved.
 */
export function suggestItinerary({
  recommendations,
  planned = [],
  perDay = 2,
  limit = 6,
  days,
  partySize = 1,
  budgetMinor = null,
  preferredTimes = [],
  minPercent = 50,
}: {
  recommendations: Recommendation[];
  planned?: (PlannedSession & { category?: ExperienceCategory })[];
  perDay?: number;
  limit?: number;
  /** Resort-local date keys to fill; omit to allow any day the sessions fall on. */
  days?: string[];
  partySize?: number;
  /** Remaining activity budget for the whole party; null = no budget. */
  budgetMinor?: number | null;
  preferredTimes?: TimeOfDay[];
  /** Only suggest reasonable matches; a weak match isn't worth spending budget on. */
  minPercent?: number;
}): SuggestedItinerary {
  const chosen: SuggestedSession[] = [];
  const perDayCount = new Map<string, number>();
  const categoriesByDay = new Map<string, Set<ExperienceCategory>>();
  const note = (day: string, category?: ExperienceCategory) => {
    perDayCount.set(day, (perDayCount.get(day) ?? 0) + 1);
    if (category) categoriesByDay.set(day, new Set([...(categoriesByDay.get(day) ?? []), category]));
  };
  for (const item of planned) note(toDateKey(item.startsAt), item.category);

  let remaining = budgetMinor;
  let skippedForBudget = 0;
  for (const recommendation of recommendations) {
    if (chosen.length >= limit) break;
    if (recommendation.percent < minPercent) continue;
    const { experience } = recommendation;
    const costMinor = experience.priceFromMinor * partySize;
    if (remaining !== null && costMinor > remaining) {
      skippedForBudget++;
      continue;
    }
    const taken = [...planned, ...chosen.map((item) => item.slot)];
    const candidates = recommendation.sessions.filter((candidate) => {
      const day = toDateKey(candidate.startsAt);
      if (days && !days.includes(day)) return false;
      if ((perDayCount.get(day) ?? 0) >= perDay) return false;
      if (bookableSeats(candidate) < partySize || !isReady(candidate)) return false;
      return !taken.some((other) => overlaps(other, candidate));
    });
    if (!candidates.length) continue;

    // Spread across days first, then vary categories within a day, then preferred times.
    const rank = (slot: ExperienceSlot) => {
      const day = toDateKey(slot.startsAt);
      return [
        perDayCount.get(day) ?? 0,
        categoriesByDay.get(day)?.has(experience.category) ? 1 : 0,
        preferredTimes.length && !preferredTimes.includes(timeOfDay(slot.startsAt)) ? 1 : 0,
      ];
    };
    const slot = candidates
      .map((candidate) => ({ candidate, key: rank(candidate) }))
      .sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2] || a.candidate.startsAt.localeCompare(b.candidate.startsAt))[0]
      .candidate;

    chosen.push({ recommendation, slot, costMinor });
    note(toDateKey(slot.startsAt), experience.category);
    if (remaining !== null) remaining -= costMinor;
  }

  return {
    sessions: chosen.sort((a, b) => a.slot.startsAt.localeCompare(b.slot.startsAt)),
    totalMinor: chosen.reduce((sum, item) => sum + item.costMinor, 0),
    remainingMinor: remaining,
    skippedForBudget,
  };
}
