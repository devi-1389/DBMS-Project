import "server-only";

import type { z } from "zod";

import type { ActionFailure, ActionResult } from "@/lib/auth/guards";
import { AuthorizationError, type DalResult } from "@/lib/dal/errors";
import { toFieldErrors } from "@/lib/validation/schemas";

export function fromDal<T>(result: DalResult<T>): ActionResult<T> {
  if (result.ok) return { ok: true, data: result.value, message: result.message };
  return {
    ok: false,
    code: result.code,
    message: result.message,
    fieldErrors: result.field ? { [result.field]: result.message } : undefined,
  };
}

export function invalid(error: z.ZodError, fallback = "Please check the highlighted fields."): ActionFailure {
  const { fieldErrors, formError } = toFieldErrors(error);
  return { ok: false, code: "invalid", message: formError ?? fallback, fieldErrors };
}

/** Logs the real error server-side and returns a safe message. */
export function unexpected(error: unknown, context: string): ActionFailure {
  if (error instanceof AuthorizationError) return { ok: false, code: "forbidden", message: error.message };
  console.error(`[action:${context}]`, error);
  return { ok: false, code: "server-error", message: "Something went wrong on our side. Please try again." };
}
