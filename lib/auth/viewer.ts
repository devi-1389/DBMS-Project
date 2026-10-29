import "server-only";

import { cache } from "react";

import { getClerkSession, getVerifiedClerkIdentity } from "@/lib/auth/clerk";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/auth/config";
import type { Viewer } from "@/lib/auth/types";
import { getDb } from "@/lib/db";
import { findViewer, provisionViewer } from "@/lib/dal/identity";

export type ViewerState =
  | { status: "auth-unconfigured" }
  | { status: "signed-out" }
  | { status: "db-unconfigured" }
  | { status: "unverified-email" }
  | { status: "identity-conflict"; message: string }
  | { status: "signed-in"; viewer: Viewer };

/**
 * Who is making this request, resolved once per request. Reads request headers, so
 * callers must render inside <Suspense> (Cache Components).
 */
export const getViewerState = cache(async (): Promise<ViewerState> => {
  if (!isClerkConfigured()) return { status: "auth-unconfigured" };

  const session = await getClerkSession();
  if (session.status === "signed-out") return { status: "signed-out" };
  if (!isDatabaseConfigured()) return { status: "db-unconfigured" };

  const db = getDb();
  const known = await findViewer(db, { provider: "clerk", providerUserId: session.providerUserId });
  if (known) return { status: "signed-in", viewer: known };

  // First visit after sign-up: create the guest account from verified details.
  const identity = await getVerifiedClerkIdentity();
  if (!identity || identity.providerUserId !== session.providerUserId) return { status: "unverified-email" };
  const result = await provisionViewer(db, identity);
  return result.ok
    ? { status: "signed-in", viewer: result.viewer }
    : { status: "identity-conflict", message: result.message };
});
