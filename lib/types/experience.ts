import type { ExperienceCategory } from "@/lib/categories";
import type { Difficulty } from "@/lib/difficulty";
import type { InterestId } from "@/lib/interests";

export type { Difficulty } from "@/lib/difficulty";

export type ImageAsset = {
  src: string;
  alt: string;
};

/** Experience shape returned to the UI. The future DAL must return this same DTO. */
export type ExperienceSummary = {
  slug: string;
  title: string;
  category: ExperienceCategory;
  summary: string;
  description: string;
  highlights: string[];
  interests: InterestId[];
  location: string;
  meetingPoint: string;
  accessible: boolean;
  durationMinutes: number;
  difficulty: Difficulty;
  maxGroupSize: number;
  minAge: number;
  priceFromMinor: number;
  currency: string;
  image: ImageAsset;
  featured: boolean;
};

/**
 * Whether a session can actually run (from the `slot_readiness` view): its guide or host
 * is assigned, its venue/boats/vehicles are held, and shared equipment pools have units.
 */
export type SlotReadiness = {
  ready: boolean;
  staff: string[];
  /** Resources confirmed for the session. */
  resources: string[];
  /** Resources that aren't available. */
  missing: string[];
  /** Seats a new party can actually use: seats left, capped by shared equipment pools. */
  bookableSeats: number;
  /** The shared pool that caps seats, when it does (e.g. "Single kayak"). */
  limitedBy: string | null;
};

/** A scheduled session of an experience. Times are ISO 8601 strings. */
export type ExperienceSlot = {
  id: string;
  experienceSlug: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  booked: number;
  /** Present for database sessions; placeholder sessions have none. */
  readiness?: SlotReadiness;
};

export type CategoryHighlight = {
  category: ExperienceCategory;
  tagline: string;
  description: string;
  image: ImageAsset;
};
