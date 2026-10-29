// Recommendation filters <-> URL search params, with defaults from the guest's
// preferences and plan. Invalid values fall back to defaults rather than erroring.
import { addDays, daysBetween, isDateKey, resortDayWindow, toDateKey } from "@/lib/format";
import type { RecommendationFilters } from "@/lib/matching/recommend";
import { BUDGET_OPTIONS } from "@/lib/preferences";
import type { GuestPreferences, TimeOfDay } from "@/lib/types/guest";
import { MAX_PARTY_SIZE } from "@/lib/validation/schemas";

const TIMES: TimeOfDay[] = ["morning", "daytime", "evening"];
export const MAX_FILTER_DAYS = 60;

type Params = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export function defaultFilters(
  preferences: GuestPreferences,
  plan: { arrival: string | null; departure: string | null } | null,
  now: Date,
): RecommendationFilters {
  const today = toDateKey(now.toISOString());
  const from = plan?.arrival && plan.arrival >= today ? plan.arrival : today;
  const to = plan?.departure && plan.departure >= from ? plan.departure : addDays(from, 30);
  return {
    from,
    to,
    partySize: preferences.groupSize,
    maxPricePerGuestMinor: preferences.budgetMaxMinor,
    timesOfDay: [],
    availableOnly: true,
    avoidConflicts: true,
  };
}

export function parseFilters(params: Params, defaults: RecommendationFilters): RecommendationFilters {
  const from = first(params.from);
  const to = first(params.to);
  const party = Number(first(params.party));
  const budget = first(params.budget);
  // Accept repeated (?times=a&times=b) and comma-separated (?times=a,b) values.
  const rawTimes = [params.times ?? []].flat().flatMap((value) => value.split(","));
  const times = [...new Set(rawTimes)].filter((value): value is TimeOfDay => TIMES.includes(value as TimeOfDay));

  const filters: RecommendationFilters = {
    from: isDateKey(from) ? from : defaults.from,
    to: isDateKey(to) ? to : defaults.to,
    partySize: Number.isInteger(party) && party >= 1 && party <= MAX_PARTY_SIZE ? party : defaults.partySize,
    maxPricePerGuestMinor:
      budget === "any"
        ? null
        : budget && BUDGET_OPTIONS.includes(Number(budget))
          ? Number(budget)
          : defaults.maxPricePerGuestMinor,
    timesOfDay: params.times !== undefined ? times : defaults.timesOfDay,
    availableOnly: first(params.available) !== "0",
    avoidConflicts: first(params.conflicts) !== "0",
  };
  // Keep the window sane: ordered and at most MAX_FILTER_DAYS long.
  if (filters.to < filters.from) filters.to = filters.from;
  if (daysBetween(filters.from, filters.to) > MAX_FILTER_DAYS) filters.to = addDays(filters.from, MAX_FILTER_DAYS);
  return filters;
}

/** Inclusive resort-local date keys → half-open time window for queries. */
export function filterWindow(filters: RecommendationFilters) {
  return resortDayWindow(filters.from, filters.to);
}
