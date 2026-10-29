"use server";

import { refresh } from "next/cache";

import { fromDal, invalid, unexpected } from "@/lib/actions/results";
import { authorizeAction, type ActionResult } from "@/lib/auth/guards";
import type { UserRole } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";
import { changeUserRole } from "@/lib/dal/users";
import { roleChangeSchema } from "@/lib/validation/schemas";

/** Administrators only, enforced here and again (from the database) in the DAL. */
export async function changeUserRoleAction(input: unknown): Promise<ActionResult<{ userId: string; role: UserRole }>> {
  const access = await authorizeAction("admin");
  if (!access.ok) return access;
  const parsed = roleChangeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const result = fromDal(await changeUserRole(getDb(), access.viewer, parsed.data));
    if (result.ok) refresh();
    return result;
  } catch (error) {
    return unexpected(error, "changeUserRole");
  }
}
