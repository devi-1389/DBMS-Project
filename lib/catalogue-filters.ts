import { CATEGORY_LABELS, isExperienceCategory, type ExperienceCategory } from "@/lib/categories";
import { isDifficulty, type Difficulty } from "@/lib/difficulty";
import { isDateKey, toDateKey } from "@/lib/format";
import { INTEREST_LABELS } from "@/lib/interests";
import type { ExperienceSlot, ExperienceSummary } from "@/lib/types/experience";

export const SORT_OPTIONS = [
  { value: "recommended", label: "Recommended" },
  { value: "soonest", label: "Soonest available" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "duration", label: "Shortest first" },
] as const;
export type SortKey = (typeof SORT_OPTIONS)[number]["value"];

export const DURATION_OPTIONS = [
  { value: "any", label: "Any length", min: 0, max: Infinity },
  { value: "short", label: "Up to 2 hours", min: 0, max: 120 },
  { value: "half", label: "2 to 4 hours", min: 121, max: 240 },
  { value: "long", label: "Over 4 hours", min: 241, max: Infinity },
] as const;
export type DurationKey = (typeof DURATION_OPTIONS)[number]["value"];

/** Max price per guest in minor units; "any" = no cap. */
export const PRICE_OPTIONS = [
  { value: "any", maxMinor: Infinity },
  { value: "100", maxMinor: 10_000 },
  { value: "200", maxMinor: 20_000 },
  { value: "300", maxMinor: 30_000 },
] as const;
export type PriceKey = (typeof PRICE_OPTIONS)[number]["value"];

export type CatalogueFilters = {
  q: string;
  categories: ExperienceCategory[];
  difficulties: Difficulty[];
  duration: DurationKey;
  price: PriceKey;
  date: string | null;
  accessible: boolean;
  sort: SortKey;
};

export const DEFAULT_FILTERS: CatalogueFilters = {
  q: "",
  categories: [],
  difficulties: [],
  duration: "any",
  price: "any",
  date: null,
  accessible: false,
  sort: "recommended",
};

const list = (value: string | null) => (value ? value.split(",").filter(Boolean) : []);
const oneOf = <T extends string>(options: readonly { value: T }[], value: string | null, fallback: T): T =>
  options.find((option) => option.value === value)?.value ?? fallback;

export function parseFilters(params: { get(name: string): string | null }): CatalogueFilters {
  const date = params.get("date");
  return {
    q: (params.get("q") ?? "").slice(0, 80),
    categories: [...new Set(list(params.get("category")).filter(isExperienceCategory))],
    difficulties: [...new Set(list(params.get("difficulty")).filter(isDifficulty))],
    duration: oneOf(DURATION_OPTIONS, params.get("duration"), "any"),
    price: oneOf(PRICE_OPTIONS, params.get("price"), "any"),
    date: isDateKey(date) ? date : null,
    accessible: params.get("accessible") === "1",
    sort: oneOf(SORT_OPTIONS, params.get("sort"), "recommended"),
  };
}

/** Query string without defaults, e.g. "category=nature&sort=price-asc". */
export function filtersToQuery(filters: CatalogueFilters) {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q);
  if (filters.categories.length) params.set("category", filters.categories.join(","));
  if (filters.difficulties.length) params.set("difficulty", filters.difficulties.join(","));
  if (filters.duration !== "any") params.set("duration", filters.duration);
  if (filters.price !== "any") params.set("price", filters.price);
  if (filters.date) params.set("date", filters.date);
  if (filters.accessible) params.set("accessible", "1");
  if (filters.sort !== "recommended") params.set("sort", filters.sort);
  return params.toString();
}

export function countActiveFilters(filters: CatalogueFilters) {
  return (
    filters.categories.length +
    filters.difficulties.length +
    Number(filters.duration !== "any") +
    Number(filters.price !== "any") +
    Number(filters.date !== null) +
    Number(filters.accessible) +
    Number(filters.q.trim() !== "")
  );
}

/** Sessions with seats left, grouped by experience and sorted by start time. */
export function openSlotsBySlug(slots: ExperienceSlot[]) {
  const map = new Map<string, ExperienceSlot[]>();
  for (const slot of slots) {
    if (slot.booked >= slot.capacity) continue;
    const list = map.get(slot.experienceSlug) ?? [];
    list.push(slot);
    map.set(slot.experienceSlug, list);
  }
  for (const list of map.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return map;
}

function matchesQuery(experience: ExperienceSummary, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    experience.title,
    experience.summary,
    experience.location,
    CATEGORY_LABELS[experience.category],
    ...experience.interests.map((interest) => INTEREST_LABELS[interest]),
  ]
    .join(" ")
    .toLowerCase();
  return needle.split(/\s+/).every((word) => haystack.includes(word));
}

export function applyFilters(
  experiences: ExperienceSummary[],
  openSlots: Map<string, ExperienceSlot[]>,
  filters: CatalogueFilters,
) {
  const duration = DURATION_OPTIONS.find((option) => option.value === filters.duration)!;
  const price = PRICE_OPTIONS.find((option) => option.value === filters.price)!;

  const results = experiences.filter((experience) => {
    if (filters.categories.length && !filters.categories.includes(experience.category)) return false;
    if (filters.difficulties.length && !filters.difficulties.includes(experience.difficulty)) return false;
    if (experience.durationMinutes < duration.min || experience.durationMinutes > duration.max) return false;
    if (experience.priceFromMinor > price.maxMinor) return false;
    if (filters.accessible && !experience.accessible) return false;
    if (filters.date) {
      const sessions = openSlots.get(experience.slug) ?? [];
      if (!sessions.some((slot) => toDateKey(slot.startsAt) === filters.date)) return false;
    }
    return matchesQuery(experience, filters.q);
  });

  const firstOpen = (experience: ExperienceSummary) =>
    openSlots.get(experience.slug)?.[0]?.startsAt ?? "9999";

  const sorters: Record<SortKey, (a: ExperienceSummary, b: ExperienceSummary) => number> = {
    recommended: (a, b) => Number(b.featured) - Number(a.featured),
    soonest: (a, b) => firstOpen(a).localeCompare(firstOpen(b)),
    "price-asc": (a, b) => a.priceFromMinor - b.priceFromMinor,
    "price-desc": (a, b) => b.priceFromMinor - a.priceFromMinor,
    duration: (a, b) => a.durationMinutes - b.durationMinutes,
  };

  return [...results].sort(sorters[filters.sort]);
}
