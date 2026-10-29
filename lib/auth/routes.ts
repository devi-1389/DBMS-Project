import type { Area } from "@/lib/auth/roles";

/**
 * Areas that need a signed-in user. proxy.ts uses this only for an early redirect;
 * each page, Server Action and Route Handler still checks auth itself.
 */
export const PROTECTED_AREAS: { prefix: string; area: Area }[] = [
  { prefix: "/dashboard", area: "guest" },
  { prefix: "/recommendations", area: "guest" },
  { prefix: "/itinerary", area: "guest" },
  { prefix: "/preferences", area: "guest" },
  { prefix: "/my-bookings", area: "guest" },
  { prefix: "/staff", area: "staff" },
  { prefix: "/admin", area: "admin" },
];

export function protectedAreaFor(pathname: string): Area | null {
  const match = PROTECTED_AREAS.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return match?.area ?? null;
}

/** Only same-site relative paths are allowed as post-sign-in destinations. */
export function safeReturnPath(value: string | null | undefined, fallback = "/dashboard") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}
