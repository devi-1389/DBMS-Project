import type { GuestPreferences, TimeOfDay } from "@/lib/types/guest";

export const TIMES_OF_DAY: { value: TimeOfDay; label: string; hint: string }[] = [
  { value: "morning", label: "Early riser", hint: "Starts before 11 am" },
  { value: "daytime", label: "Daytime", hint: "11 am to 5 pm" },
  { value: "evening", label: "Evenings", hint: "After 5 pm" },
];

/** Per-guest budget per experience, in minor units. null = no limit. */
export const BUDGET_OPTIONS: (number | null)[] = [10_000, 20_000, 30_000, null];

export const GROUP_SIZE_LIMITS = { min: 1, max: 12 } as const;
export const NOTES_MAX_LENGTH = 500;

export const DEFAULT_PREFERENCES: GuestPreferences = {
  interests: [],
  interestWeights: {},
  pace: "moderate",
  budgetMaxMinor: null,
  groupSize: 2,
  timesOfDay: [],
  needsAccessibility: false,
  notes: "",
  updatedAt: null,
};
