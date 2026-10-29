import "server-only";

import { and, asc, eq, gte, inArray, lt, ne } from "drizzle-orm";

import { canAccess } from "@/lib/auth/roles";
import type { Viewer } from "@/lib/auth/types";
import {
  bookings,
  experiences,
  experienceSlots,
  guestProfiles,
  staffAssignments,
  staffMembers,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import type { BookingStatus } from "@/lib/types/booking";

import { AuthorizationError } from "./errors";

export type StaffSession = {
  assignmentId: string;
  role: "lead" | "guide" | "support";
  staffName: string;
  slotId: string;
  experienceSlug: string;
  experienceTitle: string;
  meetingPoint: string;
  startsAt: string;
  endsAt: string;
  slotStatus: "scheduled" | "cancelled" | "completed";
  capacity: number;
  seatsBooked: number;
  /** Only guests on this session; names shortened for privacy. */
  manifest: { reference: string; guest: string; partySize: number; status: BookingStatus }[];
};

/**
 * Sessions the viewer works: staff see their own assignments, administrators see all.
 * Manifests only include bookings on those sessions.
 */
export async function getStaffSchedule(db: Db, viewer: Viewer, window: { from: Date; to: Date }): Promise<StaffSession[]> {
  if (!canAccess(viewer.role, "staff")) throw new AuthorizationError("Only staff can see the staff schedule.");
  if (viewer.role === "staff" && !viewer.staffId) return [];

  const conditions = [
    eq(staffAssignments.status, "assigned"),
    gte(experienceSlots.startsAt, window.from),
    lt(experienceSlots.startsAt, window.to),
  ];
  if (viewer.role !== "admin") conditions.push(eq(staffAssignments.staffId, viewer.staffId!));

  const rows = await db
    .select({
      assignmentId: staffAssignments.id,
      role: staffAssignments.role,
      staffName: staffMembers.displayName,
      slotId: experienceSlots.id,
      experienceSlug: experiences.slug,
      experienceTitle: experiences.title,
      meetingPoint: experiences.meetingPoint,
      startsAt: experienceSlots.startsAt,
      endsAt: experienceSlots.endsAt,
      slotStatus: experienceSlots.status,
      capacity: experienceSlots.capacity,
      seatsBooked: experienceSlots.seatsBooked,
    })
    .from(staffAssignments)
    .innerJoin(staffMembers, eq(staffMembers.id, staffAssignments.staffId))
    .innerJoin(experienceSlots, eq(experienceSlots.id, staffAssignments.slotId))
    .innerJoin(experiences, eq(experiences.id, experienceSlots.experienceId))
    .where(and(...conditions))
    .orderBy(asc(experienceSlots.startsAt), asc(staffMembers.displayName));
  if (!rows.length) return [];

  const manifestRows = await db
    .select({
      slotId: bookings.slotId,
      reference: bookings.reference,
      partySize: bookings.partySize,
      status: bookings.status,
      firstName: guestProfiles.firstName,
      lastName: guestProfiles.lastName,
    })
    .from(bookings)
    .innerJoin(guestProfiles, eq(guestProfiles.userId, bookings.guestId))
    .where(and(inArray(bookings.slotId, [...new Set(rows.map((row) => row.slotId))]), ne(bookings.status, "cancelled")))
    .orderBy(asc(guestProfiles.lastName));

  return rows.map((row) => ({
    ...row,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    manifest: manifestRows
      .filter((item) => item.slotId === row.slotId)
      .map((item) => ({
        reference: item.reference,
        guest: `${item.firstName} ${item.lastName ? `${item.lastName[0]}.` : ""}`.trim(),
        partySize: item.partySize,
        status: item.status,
      })),
  }));
}
