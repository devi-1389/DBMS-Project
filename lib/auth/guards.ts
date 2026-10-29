import "server-only";

import { connection } from "next/server";

import { canAccess, type Area } from "@/lib/auth/roles";
import type { Viewer } from "@/lib/auth/types";
import { getViewerState, type ViewerState } from "@/lib/auth/viewer";

export type PageAccess =
  | { kind: "allowed"; viewer: Viewer }
  | { kind: "sign-in" }
  | { kind: "forbidden"; viewer: Viewer }
  | { kind: "unavailable"; state: Exclude<ViewerState, { status: "signed-in" } | { status: "signed-out" }> };

/** Server-side gate for a page. Always evaluated per request, never prerendered. */
export async function checkPageAccess(area: Area): Promise<PageAccess> {
  await connection();
  const state = await getViewerState();
  if (state.status === "signed-out") return { kind: "sign-in" };
  if (state.status !== "signed-in") return { kind: "unavailable", state };
  return canAccess(state.viewer.role, area)
    ? { kind: "allowed", viewer: state.viewer }
    : { kind: "forbidden", viewer: state.viewer };
}

export type ActionFailure = {
  ok: false;
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
};

export type ActionResult<T = null> = { ok: true; message?: string; data: T } | ActionFailure;

const UNAVAILABLE: Record<string, string> = {
  "auth-unconfigured": "Sign-in isn't configured on this server yet.",
  "db-unconfigured": "The database isn't configured on this server yet.",
  "unverified-email": "Please verify your email address first.",
};

/** Server-side gate for a Server Action. Returns a failure result instead of redirecting. */
export async function authorizeAction(area: Area): Promise<{ ok: true; viewer: Viewer } | ActionFailure> {
  const state = await getViewerState();
  if (state.status === "signed-in") {
    return canAccess(state.viewer.role, area)
      ? { ok: true, viewer: state.viewer }
      : { ok: false, code: "forbidden", message: "You don't have permission to do that." };
  }
  if (state.status === "signed-out") {
    return { ok: false, code: "unauthenticated", message: "Please sign in to continue." };
  }
  if (state.status === "identity-conflict") return { ok: false, code: state.status, message: state.message };
  return { ok: false, code: state.status, message: UNAVAILABLE[state.status] };
}
