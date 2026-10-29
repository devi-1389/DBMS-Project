import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";

import type { VerifiedIdentity } from "@/lib/auth/types";

export type ClerkSession = { status: "signed-out" } | { status: "signed-in"; providerUserId: string };

/** The Clerk user ID from the verified session token. Reads request headers. */
export async function getClerkSession(): Promise<ClerkSession> {
  const { isAuthenticated, userId } = await auth();
  return isAuthenticated && userId ? { status: "signed-in", providerUserId: userId } : { status: "signed-out" };
}

/**
 * Profile details for first-time provisioning, from Clerk's Backend API. Returns null
 * unless the primary email address is verified, so an account is never linked to an
 * email its owner hasn't proven.
 */
export async function getVerifiedClerkIdentity(): Promise<VerifiedIdentity | null> {
  const user = await currentUser();
  const primary = user?.primaryEmailAddress;
  if (!user || !primary || primary.verification?.status !== "verified") return null;
  return {
    provider: "clerk",
    providerUserId: user.id,
    email: primary.emailAddress,
    firstName: user.firstName,
    lastName: user.lastName,
  };
}
