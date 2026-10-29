import "server-only";

import { and, asc, desc, eq, gte, lt } from "drizzle-orm";

import type { Viewer } from "@/lib/auth/types";
import {
  bookingStatusHistory,
  bookings,
  experienceCategories,
  experiences,
  experienceSlots,
  guestProfiles,
  paymentAttempts,
  staffAssignments,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { decimalToMinor } from "@/lib/money";
import type { BookingStatus, BookingSummary } from "@/lib/types/booking";

import { AuthorizationError } from "./errors";
import { toCategory } from "./mappers";

const summaryColumns = {
  id: bookings.id,
  reference: bookings.reference,
  guestId: bookings.guestId,
  slotId: bookings.slotId,
  status: bookings.status,
  partySize: bookings.partySize,
  totalAmount: bookings.totalAmount,
  currency: bookings.currency,
  startsAt: experienceSlots.startsAt,
  endsAt: experienceSlots.endsAt,
  slug: experiences.slug,
  title: experiences.title,
  meetingPoint: experiences.meetingPoint,
  categorySlug: experienceCategories.slug,
  firstName: guestProfiles.firstName,
  lastName: guestProfiles.lastName,
};

function baseQuery(db: Db) {
  return db
    .select(summaryColumns)
    .from(bookings)
    .innerJoin(experienceSlots, eq(experienceSlots.id, bookings.slotId))
    .innerJoin(experiences, eq(experiences.id, experienceSlots.experienceId))
    .innerJoin(experienceCategories, eq(experienceCategories.id, experiences.categoryId))
    .innerJoin(guestProfiles, eq(guestProfiles.userId, bookings.guestId));
}

type SummaryRow = Awaited<ReturnType<ReturnType<typeof baseQuery>["execute"]>>[number];

function toSummary(row: SummaryRow): BookingSummary {
  return {
    reference: row.reference,
    experienceSlug: row.slug,
    experienceTitle: row.title,
    category: toCategory(row.categorySlug),
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    partySize: row.partySize,
    totalMinor: decimalToMinor(row.totalAmount ?? "0"),
    currency: row.currency,
    status: row.status,
    guestName: `${row.firstName} ${row.lastName}`.trim(),
  };
}

/** The signed-in guest's own bookings only. */
export async function listGuestBookings(db: Db, guestId: string): Promise<BookingSummary[]> {
  const rows = await baseQuery(db).where(eq(bookings.guestId, guestId)).orderBy(desc(experienceSlots.startsAt));
  return rows.map(toSummary);
}

/** The guest's bookings for sessions starting within [from, to). */
export async function listGuestBookingsBetween(db: Db, guestId: string, from: Date, to: Date) {
  const rows = await baseQuery(db)
    .where(and(eq(bookings.guestId, guestId), gte(experienceSlots.startsAt, from), lt(experienceSlots.startsAt, to)))
    .orderBy(asc(experienceSlots.startsAt));
  return rows.map(toSummary);
}

export async function listAllBookings(db: Db, actor: Viewer, limit = 200): Promise<BookingSummary[]> {
  if (actor.role !== "admin") throw new AuthorizationError("Only administrators can see every booking.");
  const rows = await baseQuery(db).orderBy(desc(experienceSlots.startsAt)).limit(limit);
  return rows.map(toSummary);
}

export type BookingDetail = BookingSummary & {
  meetingPoint: string;
  ownedByViewer: boolean;
  history: { from: BookingStatus | null; to: BookingStatus; changedAt: string }[];
  payments: { method: "pay_at_resort" | "card"; status: string; amountMinor: number; attemptedAt: string }[];
};

/**
 * One booking, if the viewer may see it: its guest, staff assigned to its session, or
 * an administrator. Otherwise null, the same as for a reference that doesn't exist.
 */
export async function getBookingForViewer(db: Db, viewer: Viewer, reference: string): Promise<BookingDetail | null> {
  const [row] = await baseQuery(db).where(eq(bookings.reference, reference)).limit(1);
  if (!row) return null;

  const owner = row.guestId === viewer.userId;
  let allowed = owner || viewer.role === "admin";
  if (!allowed && viewer.role === "staff" && viewer.staffId) {
    const [assignment] = await db
      .select({ id: staffAssignments.id })
      .from(staffAssignments)
      .where(
        and(
          eq(staffAssignments.slotId, row.slotId),
          eq(staffAssignments.staffId, viewer.staffId),
          eq(staffAssignments.status, "assigned"),
        ),
      )
      .limit(1);
    allowed = Boolean(assignment);
  }
  if (!allowed) return null;

  const history = await db
    .select({ from: bookingStatusHistory.fromStatus, to: bookingStatusHistory.toStatus, changedAt: bookingStatusHistory.changedAt })
    .from(bookingStatusHistory)
    .where(eq(bookingStatusHistory.bookingId, row.id))
    .orderBy(asc(bookingStatusHistory.changedAt), asc(bookingStatusHistory.id));
  const payments = await db
    .select({
      method: paymentAttempts.method,
      status: paymentAttempts.status,
      amount: paymentAttempts.amount,
      attemptedAt: paymentAttempts.attemptedAt,
    })
    .from(paymentAttempts)
    .where(eq(paymentAttempts.bookingId, row.id))
    .orderBy(asc(paymentAttempts.attemptedAt));

  return {
    ...toSummary(row),
    meetingPoint: row.meetingPoint,
    ownedByViewer: owner,
    history: history.map((item) => ({ ...item, changedAt: item.changedAt.toISOString() })),
    payments: payments.map((item) => ({
      method: item.method,
      status: item.status,
      amountMinor: decimalToMinor(item.amount),
      attemptedAt: item.attemptedAt.toISOString(),
    })),
  };
}
