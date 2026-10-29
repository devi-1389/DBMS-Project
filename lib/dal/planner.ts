import "server-only";

import type { Db } from "@/lib/db/types";
import { itineraryTotal, stayDays } from "@/lib/itinerary";
import { defaultFilters, filterWindow } from "@/lib/matching/filters";
import { recommendExperiences, suggestItinerary, type SuggestedItinerary } from "@/lib/matching/recommend";
import type { GuestPreferences, ItineraryPlan } from "@/lib/types/guest";

import { listCatalogue } from "./catalogue";

/**
 * LUXE-ECO stay planner: ranks database experiences for the guest, then fills each day of
 * the stay (at most two sessions a day, at preferred times) with sessions that can run,
 * within whatever is left of the plan's activity budget. Null when the plan has no dates.
 */
export async function suggestDaysForPlan(
  db: Db,
  plan: ItineraryPlan,
  preferences: GuestPreferences,
  now: Date,
): Promise<SuggestedItinerary | null> {
  if (!plan.arrival || !plan.departure) return null;
  const filters = defaultFilters(preferences, plan, now);
  const catalogue = await listCatalogue(db, filterWindow(filters));
  const { recommendations } = recommendExperiences({
    ...catalogue,
    preferences,
    filters,
    planned: plan.items,
    now,
    limit: 24,
  });
  const days = stayDays(plan.arrival, plan.departure);
  return suggestItinerary({
    recommendations,
    planned: plan.items,
    days,
    perDay: 2,
    limit: Math.min(days.length * 2, 10),
    partySize: preferences.groupSize,
    budgetMinor: plan.activityBudgetMinor === null ? null : plan.activityBudgetMinor - itineraryTotal(plan.items),
    preferredTimes: preferences.timesOfDay,
  });
}
