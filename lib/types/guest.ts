import type { ExperienceCategory } from "@/lib/categories";
import type { Difficulty } from "@/lib/difficulty";
import type { InterestId } from "@/lib/interests";
import type { BookingStatus } from "@/lib/types/booking";

export type TimeOfDay = "morning" | "daytime" | "evening";

export type GuestPreferences = {
  interests: InterestId[];
  /** Favourite experience categories, e.g. nature + adventure + luxury. Empty = no preference. */
  categories: ExperienceCategory[];
  /** 1–5 per interest; interests without an entry count as 3. */
  interestWeights: Partial<Record<InterestId, number>>;
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

export type ItineraryPlanSummary = {
  id: string;
  name: string;
  arrival: string | null;
  departure: string | null;
  /** Total activity budget for the plan (whole party), in minor units; null = none. */
  activityBudgetMinor: number | null;
  currency: string;
  itemCount: number;
  updatedAt: string;
};

/** A session in a plan. Plans are suggestions for the guest, never reservations. */
export type PlannedItem = {
  id: string;
  slotId: string;
  experienceSlug: string;
  title: string;
  category: ExperienceCategory;
  imageSrc: string | null;
  startsAt: string;
  endsAt: string;
  partySize: number;
  unitPriceMinor: number;
  currency: string;
  slotStatus: "scheduled" | "cancelled" | "completed";
  seatsLeft: number;
  /** Set only when a real booking was made for this session. */
  booking: { reference: string; status: BookingStatus } | null;
};

export type ItineraryPlan = ItineraryPlanSummary & { items: PlannedItem[] };
