// Roles live in PostgreSQL (`users.role`) and are the only source of authorization.
// Nothing a client sends (form fields, Clerk metadata, cookies) can set or raise a role.

export const ROLES = ["guest", "staff", "admin"] as const;
export type UserRole = (typeof ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  guest: "Guest",
  staff: "Staff",
  admin: "Administrator",
};

export type Area = "guest" | "staff" | "admin";

/** Every signed-in user can use the guest area; staff and admin areas need those roles. */
const AREA_ROLES: Record<Area, readonly UserRole[]> = {
  guest: ROLES,
  staff: ["staff", "admin"],
  admin: ["admin"],
};

export function canAccess(role: UserRole, area: Area) {
  return AREA_ROLES[area].includes(role);
}

export function isRole(value: unknown): value is UserRole {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
