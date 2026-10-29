import "server-only";

import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";

import {
  experienceCategories,
  experienceHighlights,
  experienceInterests,
  experiences,
  experienceSlots,
  interests,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import type { ExperienceSlot, ExperienceSummary } from "@/lib/types/experience";

import { toExperienceSummary, toSlot } from "./mappers";

export type Catalogue = { experiences: ExperienceSummary[]; slots: ExperienceSlot[] };

/** Published experiences and their scheduled sessions starting within [from, to). */
export async function listCatalogue(db: Db, window: { from: Date; to: Date }): Promise<Catalogue> {
  const rows = await db
    .select({ experience: experiences, categorySlug: experienceCategories.slug })
    .from(experiences)
    .innerJoin(experienceCategories, eq(experienceCategories.id, experiences.categoryId))
    .where(eq(experiences.status, "published"))
    .orderBy(asc(experiences.title));
  if (!rows.length) return { experiences: [], slots: [] };

  const ids = rows.map((row) => row.experience.id);
  const interestRows = await db
    .select({ experienceId: experienceInterests.experienceId, slug: interests.slug })
    .from(experienceInterests)
    .innerJoin(interests, eq(interests.id, experienceInterests.interestId))
    .where(inArray(experienceInterests.experienceId, ids));
  const highlightRows = await db
    .select()
    .from(experienceHighlights)
    .where(inArray(experienceHighlights.experienceId, ids))
    .orderBy(asc(experienceHighlights.position));
  const slotRows = await db
    .select({
      id: experienceSlots.id,
      experienceId: experienceSlots.experienceId,
      startsAt: experienceSlots.startsAt,
      endsAt: experienceSlots.endsAt,
      capacity: experienceSlots.capacity,
      seatsBooked: experienceSlots.seatsBooked,
    })
    .from(experienceSlots)
    .where(
      and(
        inArray(experienceSlots.experienceId, ids),
        eq(experienceSlots.status, "scheduled"),
        gte(experienceSlots.startsAt, window.from),
        lt(experienceSlots.startsAt, window.to),
      ),
    )
    .orderBy(asc(experienceSlots.startsAt));

  const slugById = new Map(rows.map((row) => [row.experience.id, row.experience.slug]));
  return {
    experiences: rows.map((row) =>
      toExperienceSummary(
        row.experience,
        row.categorySlug,
        interestRows.filter((item) => item.experienceId === row.experience.id).map((item) => item.slug),
        highlightRows.filter((item) => item.experienceId === row.experience.id).map((item) => item.text),
      ),
    ),
    slots: slotRows.map((slot) => toSlot(slot, slugById.get(slot.experienceId)!)),
  };
}

/** Resolves a session by its natural key (unique experience + start time). */
export async function findSlotId(db: Db, experienceSlug: string, startsAt: Date) {
  const [row] = await db
    .select({ id: experienceSlots.id })
    .from(experienceSlots)
    .innerJoin(experiences, eq(experiences.id, experienceSlots.experienceId))
    .where(and(eq(experiences.slug, experienceSlug), eq(experienceSlots.startsAt, startsAt)))
    .limit(1);
  return row?.id ?? null;
}
