import { isExperienceCategory, type ExperienceCategory } from "@/lib/categories";
import type * as schema from "@/lib/db/schema";
import { isInterestId } from "@/lib/interests";
import { decimalToMinor } from "@/lib/money";
import type { ExperienceSlot, ExperienceSummary } from "@/lib/types/experience";

type ExperienceRow = typeof schema.experiences.$inferSelect;

export function toCategory(slug: string): ExperienceCategory {
  if (!isExperienceCategory(slug)) throw new Error(`Unknown experience category: ${slug}`);
  return slug;
}

export function toExperienceSummary(
  row: ExperienceRow,
  categorySlug: string,
  interestSlugs: string[],
  highlights: string[],
): ExperienceSummary {
  return {
    slug: row.slug,
    title: row.title,
    category: toCategory(categorySlug),
    summary: row.summary,
    description: row.description,
    highlights,
    interests: interestSlugs.filter(isInterestId),
    location: row.location,
    meetingPoint: row.meetingPoint,
    accessible: row.isStepFree,
    durationMinutes: row.durationMinutes,
    difficulty: row.difficulty,
    maxGroupSize: row.maxGroupSize,
    minAge: row.minAge,
    priceFromMinor: decimalToMinor(row.basePrice),
    currency: row.currency,
    image: { src: row.imageUrl ?? "/images/placeholder/hero.webp", alt: row.imageAlt ?? "" },
    featured: row.isFeatured,
  };
}

export function toSlot(
  row: { id: string; startsAt: Date; endsAt: Date; capacity: number; seatsBooked: number },
  experienceSlug: string,
): ExperienceSlot {
  return {
    id: row.id,
    experienceSlug,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    capacity: row.capacity,
    booked: row.seatsBooked,
  };
}

/** Resort-local midnight for a date key. The resort timezone is UTC for now (lib/config.ts). */
export function dateKeyStart(key: string) {
  return new Date(`${key}T00:00:00.000Z`);
}
