import type { Difficulty } from "@/lib/difficulty";
import type { InterestId } from "@/lib/interests";

export type TimeOfDay = "morning" | "daytime" | "evening";

export type GuestPreferences = {
  interests: InterestId[];
  /** Highest difficulty the guest is comfortable with. */
  pace: Difficulty;
  /** Per-guest budget per experience; null means no limit. */
  budgetMaxMinor: number | null;
  groupSize: number;
  timesOfDay: TimeOfDay[];
  needsAccessibility: boolean;
  notes: string;
  updatedAt: string | null;
};

/** A planned (not reserved) session. Slot details are copied in when added. */
export type ItineraryItem = {
  slotId: string;
  experienceSlug: string;
  title: string;
  startsAt: string;
  endsAt: string;
  partySize: number;
  unitPriceMinor: number;
  currency: string;
  addedAt: string;
};

export type ItineraryDraft = {
  arrival: string | null;
  departure: string | null;
  items: ItineraryItem[];
};
