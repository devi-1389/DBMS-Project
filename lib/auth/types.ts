import type { UserRole } from "@/lib/auth/roles";

/**
 * An identity proven by the authentication provider: the provider's user ID from a
 * verified session plus a primary email the provider has verified. It deliberately
 * has no role field.
 */
export type VerifiedIdentity = {
  provider: "clerk";
  providerUserId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

/** The signed-in user, as stored in our database. `userId` is also the guest profile ID. */
export type Viewer = {
  userId: string;
  role: UserRole;
  email: string;
  displayName: string;
  /** Set when the user has an active staff record. */
  staffId: string | null;
};
