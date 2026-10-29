import { addDays, daysBetween, isDateKey, toDateKey } from "@/lib/format";
import type { ExperienceSlot, ExperienceSummary } from "@/lib/types/experience";
import type { ItineraryDraft, ItineraryItem } from "@/lib/types/guest";

export const EMPTY_ITINERARY: ItineraryDraft = { arrival: null, departure: null, items: [] };
export const MAX_STAY_NIGHTS = 21;

export function parseItinerary(raw: unknown): ItineraryDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const items = Array.isArray(value.items) ? value.items.filter(isItem) : [];
  return {
    arrival: isDateKey(value.arrival) ? value.arrival : null,
    departure: isDateKey(value.departure) ? value.departure : null,
    items,
  };
}

function isItem(raw: unknown): raw is ItineraryItem {
  if (!raw || typeof raw !== "object") return false;
  const item = raw as Record<string, unknown>;
  return (
    typeof item.slotId === "string" &&
    typeof item.experienceSlug === "string" &&
    typeof item.title === "string" &&
    typeof item.startsAt === "string" &&
    typeof item.endsAt === "string" &&
    Number.isInteger(item.partySize) &&
    (item.partySize as number) > 0 &&
    typeof item.unitPriceMinor === "number" &&
    typeof item.currency === "string" &&
    typeof item.addedAt === "string"
  );
}

export function createItem(
  experience: ExperienceSummary,
  slot: ExperienceSlot,
  partySize: number,
): ItineraryItem {
  return {
    slotId: slot.id,
    experienceSlug: experience.slug,
    title: experience.title,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    partySize,
    unitPriceMinor: experience.priceFromMinor,
    currency: experience.currency,
    addedAt: new Date().toISOString(),
  };
}

/** Adds the item, or updates the party size if that session is already planned. */
export function upsertItem(draft: ItineraryDraft, item: ItineraryItem): ItineraryDraft {
  const exists = draft.items.some((existing) => existing.slotId === item.slotId);
  const items = exists
    ? draft.items.map((existing) =>
        existing.slotId === item.slotId ? { ...existing, partySize: item.partySize } : existing,
      )
    : [...draft.items, item];
  return { ...draft, items: sortItems(items) };
}

export function removeItem(draft: ItineraryDraft, slotId: string): ItineraryDraft {
  return { ...draft, items: draft.items.filter((item) => item.slotId !== slotId) };
}

export function sortItems(items: ItineraryItem[]) {
  return [...items].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

const overlaps = (a: Pick<ItineraryItem, "startsAt" | "endsAt">, b: Pick<ItineraryItem, "startsAt" | "endsAt">) =>
  a.startsAt < b.endsAt && b.startsAt < a.endsAt;

/** Planned items that overlap the given session, excluding the session itself. */
export function findOverlaps(
  items: ItineraryItem[],
  session: Pick<ItineraryItem, "slotId" | "startsAt" | "endsAt">,
) {
  return items.filter((item) => item.slotId !== session.slotId && overlaps(item, session));
}

/** Map of slotId → titles of other items it overlaps with. */
export function conflictMap(items: ItineraryItem[]) {
  const map = new Map<string, string[]>();
  for (const item of items) {
    const others = findOverlaps(items, item);
    if (others.length) map.set(item.slotId, others.map((other) => other.title));
  }
  return map;
}

export type StayErrors = Partial<Record<"arrival" | "departure", string>>;

export function validateStay(
  arrival: string | null,
  departure: string | null,
  window: { start: string; end: string },
): StayErrors {
  const errors: StayErrors = {};
  if (arrival && (arrival < window.start || arrival > window.end)) {
    errors.arrival = "Choose a date inside the sample season.";
  }
  if (departure && (departure < window.start || departure > window.end)) {
    errors.departure = "Choose a date inside the sample season.";
  }
  if (arrival && departure && !errors.arrival && !errors.departure) {
    const nights = daysBetween(arrival, departure);
    if (nights < 0) errors.departure = "Departure must be on or after arrival.";
    else if (nights > MAX_STAY_NIGHTS) errors.departure = `Plan up to ${MAX_STAY_NIGHTS} nights at a time.`;
  }
  return errors;
}

/** Days to show: the stay range when valid, otherwise the days that have items. */
export function planDays(draft: ItineraryDraft, stayIsValid: boolean) {
  if (stayIsValid && draft.arrival && draft.departure) {
    const count = daysBetween(draft.arrival, draft.departure) + 1;
    return Array.from({ length: count }, (_, i) => addDays(draft.arrival!, i));
  }
  return [...new Set(draft.items.map((item) => toDateKey(item.startsAt)))].sort();
}

export function itineraryTotal(items: ItineraryItem[]) {
  return items.reduce((sum, item) => sum + item.unitPriceMinor * item.partySize, 0);
}
