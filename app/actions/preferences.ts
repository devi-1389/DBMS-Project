"use server";

import { refresh } from "next/cache";

import { fromDal, invalid, unexpected } from "@/lib/actions/results";
import { authorizeAction, type ActionResult } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { ok } from "@/lib/dal/errors";
import { savePreferences } from "@/lib/dal/preferences";
import type { GuestPreferences } from "@/lib/types/guest";
import { preferencesSchema } from "@/lib/validation/schemas";

export async function savePreferencesAction(input: unknown): Promise<ActionResult<GuestPreferences>> {
  const access = await authorizeAction("guest");
  if (!access.ok) return access;

  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    const saved = await savePreferences(getDb(), access.viewer.userId, parsed.data);
    refresh();
    return fromDal(ok(saved, "Preferences saved to your account."));
  } catch (error) {
    return unexpected(error, "savePreferences");
  }
}
