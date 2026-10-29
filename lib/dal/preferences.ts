import "server-only";

import { asc, eq, inArray } from "drizzle-orm";

import { isExperienceCategory, type ExperienceCategory } from "@/lib/categories";
import {
  experienceCategories,
  guestInterests,
  guestPreferences,
  guestPreferredCategories,
  guestPreferredTimes,
  interests,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { isInterestId, type InterestId } from "@/lib/interests";
import { DEFAULT_INTEREST_WEIGHT } from "@/lib/matching/recommend";
import { decimalToMinor, minorToDecimal } from "@/lib/money";
import type { GuestPreferences } from "@/lib/types/guest";
import type { PreferencesInput } from "@/lib/validation/schemas";

export async function getPreferences(db: Db, guestId: string): Promise<GuestPreferences | null> {
  const [row] = await db.select().from(guestPreferences).where(eq(guestPreferences.guestId, guestId)).limit(1);
  if (!row) return null;

  const interestRows = await db
    .select({ slug: interests.slug, weight: guestInterests.weight })
    .from(guestInterests)
    .innerJoin(interests, eq(interests.id, guestInterests.interestId))
    .where(eq(guestInterests.guestId, guestId));
  const timeRows = await db
    .select({ timeOfDay: guestPreferredTimes.timeOfDay })
    .from(guestPreferredTimes)
    .where(eq(guestPreferredTimes.guestId, guestId));
  const categoryRows = await db
    .select({ slug: experienceCategories.slug })
    .from(guestPreferredCategories)
    .innerJoin(experienceCategories, eq(experienceCategories.id, guestPreferredCategories.categoryId))
    .where(eq(guestPreferredCategories.guestId, guestId))
    .orderBy(asc(experienceCategories.sortOrder));

  const known = interestRows.filter((item): item is { slug: InterestId; weight: number } => isInterestId(item.slug));
  return {
    interests: known.map((item) => item.slug),
    categories: categoryRows.map((item) => item.slug).filter((slug): slug is ExperienceCategory => isExperienceCategory(slug)),
    interestWeights: Object.fromEntries(known.map((item) => [item.slug, item.weight])),
    pace: row.maxDifficulty,
    budgetMaxMinor: row.budgetPerGuest === null ? null : decimalToMinor(row.budgetPerGuest),
    groupSize: row.usualGroupSize,
    timesOfDay: timeRows.map((item) => item.timeOfDay),
    needsAccessibility: row.needsStepFree,
    notes: row.notes,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Replaces the guest's preferences in one transaction. Input must already be validated. */
export async function savePreferences(db: Db, guestId: string, input: PreferencesInput): Promise<GuestPreferences> {
  await db.transaction(async (tx) => {
    const values = {
      maxDifficulty: input.pace,
      budgetPerGuest: input.budgetMaxMinor === null ? null : minorToDecimal(input.budgetMaxMinor),
      usualGroupSize: input.groupSize,
      needsStepFree: input.needsAccessibility,
      notes: input.notes,
    };
    await tx
      .insert(guestPreferences)
      .values({ guestId, ...values })
      .onConflictDoUpdate({ target: guestPreferences.guestId, set: values });

    const interestRows = await tx
      .select({ id: interests.id, slug: interests.slug })
      .from(interests)
      .where(inArray(interests.slug, input.interests));
    await tx.delete(guestInterests).where(eq(guestInterests.guestId, guestId));
    if (interestRows.length) {
      await tx.insert(guestInterests).values(
        interestRows.map((row) => ({
          guestId,
          interestId: row.id,
          weight: isInterestId(row.slug) ? (input.interestWeights[row.slug] ?? DEFAULT_INTEREST_WEIGHT) : DEFAULT_INTEREST_WEIGHT,
        })),
      );
    }

    const categoryRows = input.categories.length
      ? await tx
          .select({ id: experienceCategories.id })
          .from(experienceCategories)
          .where(inArray(experienceCategories.slug, input.categories))
      : [];
    await tx.delete(guestPreferredCategories).where(eq(guestPreferredCategories.guestId, guestId));
    if (categoryRows.length) {
      await tx.insert(guestPreferredCategories).values(categoryRows.map((row) => ({ guestId, categoryId: row.id })));
    }

    await tx.delete(guestPreferredTimes).where(eq(guestPreferredTimes.guestId, guestId));
    if (input.timesOfDay.length) {
      await tx.insert(guestPreferredTimes).values(input.timesOfDay.map((timeOfDay) => ({ guestId, timeOfDay })));
    }
  });
  return (await getPreferences(db, guestId))!;
}
