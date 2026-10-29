import type { ExperienceCategory } from "@/lib/categories";

/** Landing page section anchors. */
export const SECTION_IDS = {
  top: "top",
  categories: "categories",
  experiences: "experiences",
  matching: "matching",
  sustainability: "sustainability",
} as const;

export const ROUTES = {
  home: "/",
  experiences: "/experiences",
  preferences: "/preferences",
  itinerary: "/itinerary",
  dashboard: "/dashboard",
  myBookings: "/my-bookings",
  admin: "/admin",
  login: "/login",
} as const;

export const primaryNav = [
  { label: "Experiences", href: ROUTES.experiences },
  { label: "Preferences", href: ROUTES.preferences },
  { label: "Itinerary", href: ROUTES.itinerary },
  { label: "Sustainability", href: `/#${SECTION_IDS.sustainability}` },
] as const;

export const guestNav = [
  { label: "Dashboard", href: ROUTES.dashboard, icon: "dashboard" },
  { label: "My bookings", href: ROUTES.myBookings, icon: "bookings" },
  { label: "Itinerary", href: ROUTES.itinerary, icon: "itinerary" },
  { label: "Preferences", href: ROUTES.preferences, icon: "preferences" },
] as const;

export type GuestNavIcon = (typeof guestNav)[number]["icon"];

export function categoryHref(category: ExperienceCategory) {
  return `${ROUTES.experiences}?category=${category}`;
}

export function experienceHref(slug: string) {
  return `${ROUTES.experiences}/${slug}`;
}

/** Catalogue filtered to sessions on one resort-local date. */
export function experiencesOnDateHref(dateKey: string) {
  return `${ROUTES.experiences}?date=${dateKey}`;
}

/** True when `href` is the current page or a parent of it. Anchors never match. */
export function isActivePath(pathname: string | null, href: string) {
  if (!pathname || href.includes("#")) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
