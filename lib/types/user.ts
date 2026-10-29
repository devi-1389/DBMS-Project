import type { UserRole } from "@/lib/auth/roles";

/** An account as the admin console lists it. */
export type ManagedUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  /** False for seeded or unlinked accounts that have no sign-in identity. */
  canSignIn: boolean;
  createdAt: string;
};
