// Pure helpers for itinerary plans (shared by server pages, client components and tests).
import { addDays, daysBetween, toDateKey } from "@/lib/format";

export const MAX_STAY_NIGHTS = 21;
export const MAX_PLANS_PER_GUEST = 10;
export const MAX_ITEMS_PER_PLAN = 40;

type Timed = { id: string; startsAt: string; endsAt: string; title: string };

export function overlaps(a: { startsAt: string; endsAt: string }, b: { startsAt: string; endsAt: string }) {
  return Date.parse(a.startsAt) < Date.parse(b.endsAt) && Date.parse(b.startsAt) < Date.parse(a.endsAt);
}

/** id → titles of the other items it overlaps with. */
export function conflictMap<T extends Timed>(items: T[]) {
  const map = new Map<string, string[]>();
  for (const item of items) {
    const others = items.filter((other) => other.id !== item.id && overlaps(item, other));
    if (others.length) map.set(item.id, others.map((other) => other.title));
  }
  return map;
}

export function stayDays(arrival: string, departure: string) {
  const count = daysBetween(arrival, departure) + 1;
  return Array.from({ length: Math.max(0, count) }, (_, i) => addDays(arrival, i));
}

/** The stay's days when both dates are set, otherwise the days that have items. */
export function planDays(plan: { arrival: string | null; departure: string | null }, items: { startsAt: string }[]) {
  if (plan.arrival && plan.departure && plan.departure >= plan.arrival) return stayDays(plan.arrival, plan.departure);
  return [...new Set(items.map((item) => toDateKey(item.startsAt)))].sort();
}

export function isOutsideStay(startsAt: string, arrival: string | null, departure: string | null) {
  const day = toDateKey(startsAt);
  return Boolean((arrival && day < arrival) || (departure && day > departure));
}

export function itineraryTotal(items: { unitPriceMinor: number; partySize: number }[]) {
  return items.reduce((sum, item) => sum + item.unitPriceMinor * item.partySize, 0);
}
