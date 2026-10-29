import { isDifficulty } from "@/lib/difficulty";
import { isInterestId } from "@/lib/interests";
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
  pace: "moderate",
  budgetMaxMinor: null,
  groupSize: 2,
  timesOfDay: [],
  needsAccessibility: false,
  notes: "",
  updatedAt: null,
};

const isTimeOfDay = (value: unknown): value is TimeOfDay =>
  TIMES_OF_DAY.some((option) => option.value === value);

/** Defensive parse of stored preferences. Unknown or malformed input returns null. */
export function parsePreferences(raw: unknown): GuestPreferences | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (!Array.isArray(value.interests) || !isDifficulty(value.pace)) return null;

  const groupSize = Number(value.groupSize);
  const budget = value.budgetMaxMinor;

  return {
    interests: value.interests.filter(isInterestId),
    pace: value.pace,
    budgetMaxMinor: typeof budget === "number" && BUDGET_OPTIONS.includes(budget) ? budget : null,
    groupSize:
      Number.isInteger(groupSize) && groupSize >= GROUP_SIZE_LIMITS.min && groupSize <= GROUP_SIZE_LIMITS.max
        ? groupSize
        : DEFAULT_PREFERENCES.groupSize,
    timesOfDay: Array.isArray(value.timesOfDay) ? value.timesOfDay.filter(isTimeOfDay) : [],
    needsAccessibility: value.needsAccessibility === true,
    notes: typeof value.notes === "string" ? value.notes.slice(0, NOTES_MAX_LENGTH) : "",
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
  };
}

export type PreferencesErrors = Partial<Record<"interests" | "groupSize" | "notes", string>>;

export function validatePreferences(preferences: GuestPreferences): PreferencesErrors {
  const errors: PreferencesErrors = {};
  if (preferences.interests.length === 0) errors.interests = "Choose at least one interest.";
  if (
    !Number.isInteger(preferences.groupSize) ||
    preferences.groupSize < GROUP_SIZE_LIMITS.min ||
    preferences.groupSize > GROUP_SIZE_LIMITS.max
  ) {
    errors.groupSize = `Group size must be between ${GROUP_SIZE_LIMITS.min} and ${GROUP_SIZE_LIMITS.max}.`;
  }
  if (preferences.notes.length > NOTES_MAX_LENGTH) {
    errors.notes = `Keep notes under ${NOTES_MAX_LENGTH} characters.`;
  }
  return errors;
}
