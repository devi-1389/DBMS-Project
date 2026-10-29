// Explainable recommendations: hard filters first (each with a stated reason), then a
// score made of named factors so guests can see exactly why something ranked where it
// did. Pure: the same code ranks database records on the server and previews on the client.
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
  /** Only sessions with enough seats left for the party. */
  availableOnly: boolean;
  /** Skip sessions that overlap something already planned. */
  avoidConflicts: boolean;
};

export type PlannedSession = { slotId: string; startsAt: string; endsAt: string };

export type FactorKey = "interests" | "pace" | "budget" | "timing" | "flexibility";

export type ScoreFactor = { key: FactorKey; label: string; points: number; max: number; detail: string };

export type Recommendation = {
  experience: ExperienceSummary;
  score: number;
  maxScore: number;
  /** score / maxScore, 0–100. */
  percent: number;
  factors: ScoreFactor[];
  reasons: string[];
  /** Sessions that pass every filter, soonest first (up to 4). */
  sessions: ExperienceSlot[];
  fittingSessionCount: number;
};

export type ExclusionReason =
  | "step-free"
  | "too-challenging"
  | "group-too-large"
  | "over-budget"
  | "no-fitting-session";

export const EXCLUSION_LABELS: Record<ExclusionReason, string> = {
  "step-free": "need step-free access you asked for",
  "too-challenging": "are harder than your chosen pace",
  "group-too-large": "can't take a group of this size",
  "over-budget": "cost more than your budget",
  "no-fitting-session": "have no session that fits your dates, party size or schedule",
};

export type RecommendationResult = {
  recommendations: Recommendation[];
  excluded: Partial<Record<ExclusionReason, number>>;
};

const seatsLeft = (slot: ExperienceSlot) => slot.capacity - slot.booked;

function weightOf(preferences: GuestPreferences, interest: InterestId) {
  return preferences.interestWeights[interest] ?? DEFAULT_INTEREST_WEIGHT;
}

function fittingSessions(
  slots: ExperienceSlot[],
  filters: RecommendationFilters,
  planned: PlannedSession[],
  now: Date,
) {
  return slots
    .filter((slot) => {
      if (Date.parse(slot.startsAt) <= now.getTime()) return false;
      const day = toDateKey(slot.startsAt);
      if (day < filters.from || day > filters.to) return false;
      if (filters.availableOnly && seatsLeft(slot) < filters.partySize) return false;
      if (filters.timesOfDay.length && !filters.timesOfDay.includes(timeOfDay(slot.startsAt))) return false;
      if (planned.some((item) => item.slotId === slot.id)) return false;
      if (filters.avoidConflicts && planned.some((item) => overlaps(item, slot))) return false;
      return true;
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
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
    const sessions = fittingSessions(slotsBySlug.get(experience.slug) ?? [], filters, planned, now);
    if (!sessions.length) {
      exclude("no-fitting-session");
      continue;
    }

    const factors = scoreFactors(experience, sessions, preferences);
    const score = factors.reduce((sum, factor) => sum + factor.points, 0);
    const maxScore = factors.reduce((sum, factor) => sum + factor.max, 0);
    recommendations.push({
      experience,
      score,
      maxScore,
      percent: maxScore ? Math.round((score / maxScore) * 100) : 0,
      factors,
      reasons: reasonsFrom(factors),
      sessions: sessions.slice(0, 4),
      fittingSessionCount: sessions.length,
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

export type SuggestedSession = { recommendation: Recommendation; slot: ExperienceSlot };

/**
 * A suggested itinerary: the best recommendations placed on non-overlapping sessions,
 * at most `perDay` per day. It's only a suggestion; nothing is saved or reserved.
 */
export function suggestItinerary({
  recommendations,
  planned = [],
  perDay = 2,
  limit = 6,
}: {
  recommendations: Recommendation[];
  planned?: PlannedSession[];
  perDay?: number;
  limit?: number;
}): SuggestedSession[] {
  const chosen: SuggestedSession[] = [];
  const perDayCount = new Map<string, number>();
  for (const item of planned) {
    const day = toDateKey(item.startsAt);
    perDayCount.set(day, (perDayCount.get(day) ?? 0) + 1);
  }

  for (const recommendation of recommendations) {
    if (chosen.length >= limit) break;
    const slot = recommendation.sessions.find((candidate) => {
      const day = toDateKey(candidate.startsAt);
      if ((perDayCount.get(day) ?? 0) >= perDay) return false;
      return ![...planned, ...chosen.map((item) => item.slot)].some((other) => overlaps(other, candidate));
    });
    if (!slot) continue;
    chosen.push({ recommendation, slot });
    const day = toDateKey(slot.startsAt);
    perDayCount.set(day, (perDayCount.get(day) ?? 0) + 1);
  }
  return chosen.sort((a, b) => a.slot.startsAt.localeCompare(b.slot.startsAt));
}
