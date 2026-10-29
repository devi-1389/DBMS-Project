// Zod schemas shared by client forms and Server Actions. The server always re-validates;
// strict objects reject unknown keys, so a request can't smuggle in fields like `role`.
import { z } from "zod";

import { ROLES } from "@/lib/auth/roles";
import { DIFFICULTIES } from "@/lib/difficulty";
import { daysBetween, isDateKey } from "@/lib/format";
import { INTERESTS, type InterestId } from "@/lib/interests";
import { MAX_STAY_NIGHTS } from "@/lib/itinerary";
import { GROUP_SIZE_LIMITS, NOTES_MAX_LENGTH } from "@/lib/preferences";

const INTEREST_IDS = INTERESTS.map((interest) => interest.id) as [InterestId, ...InterestId[]];
const TIMES = ["morning", "daytime", "evening"] as const;
export const MAX_PARTY_SIZE = 20;

const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD.")
  .refine(isDateKey, "Enter a real date.");

const partySize = z
  .number({ error: "Enter the number of guests." })
  .int("Guests must be a whole number.")
  .min(1, "At least 1 guest.")
  .max(MAX_PARTY_SIZE, `At most ${MAX_PARTY_SIZE} guests.`);

export const preferencesSchema = z.strictObject({
  interests: z
    .array(z.enum(INTEREST_IDS, { error: "Unknown interest." }))
    .min(1, "Choose at least one interest.")
    .max(INTERESTS.length),
  interestWeights: z.partialRecord(z.enum(INTEREST_IDS), z.number().int().min(1).max(5)).default({}),
  pace: z.enum(DIFFICULTIES, { error: "Choose a pace." }),
  budgetMaxMinor: z.number().int().min(0, "Budget can't be negative.").max(1_000_000).nullable(),
  groupSize: z
    .number({ error: "Enter a group size." })
    .int("Group size must be a whole number.")
    .min(GROUP_SIZE_LIMITS.min, `Group size must be at least ${GROUP_SIZE_LIMITS.min}.`)
    .max(GROUP_SIZE_LIMITS.max, `Group size can be at most ${GROUP_SIZE_LIMITS.max}.`),
  timesOfDay: z.array(z.enum(TIMES)).max(TIMES.length),
  needsAccessibility: z.boolean(),
  notes: z.string().trim().max(NOTES_MAX_LENGTH, `Keep notes under ${NOTES_MAX_LENGTH} characters.`),
});
export type PreferencesInput = z.infer<typeof preferencesSchema>;

export const planSchema = z
  .strictObject({
    name: z.string().trim().min(1, "Give your plan a name.").max(80, "Use 80 characters or fewer."),
    arrival: dateKey.nullable(),
    departure: dateKey.nullable(),
  })
  .superRefine((plan, ctx) => {
    if (!plan.arrival || !plan.departure) return;
    const nights = daysBetween(plan.arrival, plan.departure);
    if (nights < 0) {
      ctx.addIssue({ code: "custom", path: ["departure"], message: "Departure must be on or after arrival." });
    } else if (nights > MAX_STAY_NIGHTS) {
      ctx.addIssue({ code: "custom", path: ["departure"], message: `Plan up to ${MAX_STAY_NIGHTS} nights at a time.` });
    }
  });
export type PlanInput = z.infer<typeof planSchema>;

/** Add a session by its database slot ID. */
export const addItemSchema = z.strictObject({
  planId: z.uuid("Unknown plan.").optional(),
  slotId: z.uuid("Unknown session."),
  partySize,
});

/** Add a session by its natural key (experience slug + start time), from catalogue pages. */
export const addSessionSchema = z.strictObject({
  planId: z.uuid("Unknown plan.").optional(),
  experienceSlug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Unknown experience."),
  startsAt: z.iso.datetime({ error: "Unknown session time." }),
  partySize,
});

export const updateItemSchema = z.strictObject({ itemId: z.uuid("Unknown plan item."), partySize });
export const idSchema = z.uuid("Unknown item.");

export const roleChangeSchema = z.strictObject({
  userId: z.uuid("Unknown user."),
  role: z.enum(ROLES, { error: "Choose a valid role." }),
});

/** First message per field, plus a general message for form-level problems. */
export function toFieldErrors(error: z.ZodError) {
  const flat = z.flattenError(error);
  const fieldErrors: Record<string, string> = {};
  for (const [field, messages] of Object.entries(flat.fieldErrors) as [string, string[] | undefined][]) {
    if (messages?.length) fieldErrors[field] = messages[0];
  }
  return { fieldErrors, formError: flat.formErrors[0] ?? null };
}
