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

/** A scheduled session of an experience. Times are ISO 8601 strings. */
export type ExperienceSlot = {
  id: string;
  experienceSlug: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  booked: number;
};

export type CategoryHighlight = {
  category: ExperienceCategory;
  tagline: string;
  description: string;
  image: ImageAsset;
};
