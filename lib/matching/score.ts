// Rule-based, explainable matching (docs/IMPLEMENTATION_PLAN.md §5). Pure functions:
// no I/O, so the same code can run on the server once preferences are stored.
import { DIFFICULTY_LABELS, DIFFICULTY_RANK } from "@/lib/difficulty";
import { formatPrice, joinList, timeOfDay } from "@/lib/format";
import { INTEREST_LABELS } from "@/lib/interests";
import type { ExperienceSlot, ExperienceSummary } from "@/lib/types/experience";
import type { GuestPreferences, TimeOfDay } from "@/lib/types/guest";

export type MatchResult = {
  experience: ExperienceSummary;
  score: number;
  sharedInterests: number;
  reasons: string[];
};

const TIME_REASONS: Record<TimeOfDay, string> = {
  morning: "Morning sessions for an early riser",
  daytime: "Runs during the day",
  evening: "Evening sessions available",
};

export function scoreExperience(
  experience: ExperienceSummary,
  preferences: GuestPreferences,
  sessionTimes: Set<TimeOfDay>,
): MatchResult | null {
  // Hard filters: never suggest something the guest can't or won't do.
  if (preferences.needsAccessibility && !experience.accessible) return null;
  if (DIFFICULTY_RANK[experience.difficulty] > DIFFICULTY_RANK[preferences.pace]) return null;
  if (preferences.groupSize > experience.maxGroupSize) return null;

  let score = 0;
  const reasons: string[] = [];

  const shared = experience.interests.filter((interest) => preferences.interests.includes(interest));
  if (shared.length) {
    score += shared.length * 3;
    reasons.push(
      `Matches your interest in ${joinList(shared.map((interest) => INTEREST_LABELS[interest].toLowerCase()))}`,
    );
  }

  const budget = preferences.budgetMaxMinor;
  if (budget === null || experience.priceFromMinor <= budget) {
    score += 1;
    if (budget !== null) {
      reasons.push(
        experience.priceFromMinor === 0
          ? "Complimentary, so well within budget"
          : `${formatPrice(experience.priceFromMinor, experience.currency)} per guest, within your budget`,
      );
    }
  } else {
    score -= 2;
  }

  if (experience.difficulty === preferences.pace) {
    score += 1;
    reasons.push(`${DIFFICULTY_LABELS[experience.difficulty]} pace, as you prefer`);
  }

  const time = preferences.timesOfDay.find((preferred) => sessionTimes.has(preferred));
  if (time) {
    score += 1;
    reasons.push(TIME_REASONS[time]);
  }

  if (preferences.needsAccessibility) reasons.push("Step-free access");
  if (experience.featured) score += 0.5;

  return { experience, score, sharedInterests: shared.length, reasons };
}

/** Best matches first. Experiences sharing an interest always rank above those that don't. */
export function rankExperiences(
  experiences: ExperienceSummary[],
  slots: ExperienceSlot[],
  preferences: GuestPreferences,
  limit = 3,
): MatchResult[] {
  const timesBySlug = new Map<string, Set<TimeOfDay>>();
  for (const slot of slots) {
    const set = timesBySlug.get(slot.experienceSlug) ?? new Set<TimeOfDay>();
    set.add(timeOfDay(slot.startsAt));
    timesBySlug.set(slot.experienceSlug, set);
  }

  return experiences
    .map((experience) => scoreExperience(experience, preferences, timesBySlug.get(experience.slug) ?? new Set()))
    .filter((result): result is MatchResult => result !== null)
    .sort(
      (a, b) =>
        Number(b.sharedInterests > 0) - Number(a.sharedInterests > 0) ||
        b.score - a.score ||
        a.experience.priceFromMinor - b.experience.priceFromMinor,
    )
    .slice(0, limit)
    .map((result) =>
      result.reasons.length ? result : { ...result, reasons: ["Fits your pace and group size"] },
    );
}
