import Link from "next/link";
import { CalendarClock, MapPin, Users } from "lucide-react";

import { OccupancyBar } from "@/components/admin/occupancy-bar";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { StaffSession } from "@/lib/dal/staff";
import { formatDate, formatTimeRange } from "@/lib/format";
import { bookingHref, experienceHref } from "@/lib/navigation";

const ROLE_LABEL: Record<StaffSession["role"], string> = { lead: "Lead", guide: "Guide", support: "Support" };

/** Server-rendered list of assigned sessions and their guest manifests. */
export function StaffSchedule({
  sessions,
  showStaff,
  hasStaffRecord,
}: {
  sessions: StaffSession[];
  showStaff: boolean;
  hasStaffRecord: boolean;
}) {
  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="No sessions assigned"
        description={
          hasStaffRecord || showStaff
            ? "Nothing is assigned in this window. New assignments appear here."
            : "Your account has the staff role but no staff record yet. Ask an administrator to re-save your role."
        }
      />
    );
  }

  return (
    <ol className="space-y-4">
      {sessions.map((session) => {
        const guests = session.manifest.reduce((sum, item) => sum + item.partySize, 0);
        return (
          <li key={session.assignmentId} className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gold-700">
                  {formatDate(session.startsAt)} · {formatTimeRange(session.startsAt, session.endsAt)}
                </p>
                <h2 className="mt-1 font-display text-2xl leading-tight font-semibold">
                  <Link href={experienceHref(session.experienceSlug)} className="hover:underline hover:underline-offset-4">
                    {session.experienceTitle}
                  </Link>
                </h2>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {session.meetingPoint}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex gap-2">
                  {showStaff && <Badge variant="outline">{session.staffName}</Badge>}
                  <Badge variant="secondary">{ROLE_LABEL[session.role]}</Badge>
                  {session.slotStatus !== "scheduled" && <Badge variant="outline">{session.slotStatus}</Badge>}
                </div>
                <OccupancyBar booked={session.seatsBooked} capacity={session.capacity} />
              </div>
            </div>

            <div className="mt-5 border-t pt-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Users className="size-4" aria-hidden="true" />
                Guests ({guests})
              </h3>
              {session.manifest.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No bookings yet.</p>
              ) : (
                <ul className="mt-2 divide-y text-sm">
                  {session.manifest.map((item) => (
                    <li key={item.reference} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0 truncate">
                        <Link href={bookingHref(item.reference)} className="font-mono text-xs font-semibold hover:underline">
                          {item.reference}
                        </Link>{" "}
                        {item.guest} · {item.partySize} guest{item.partySize > 1 ? "s" : ""}
                      </span>
                      <BookingStatusBadge status={item.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function StaffScheduleSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading schedule">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-48 rounded-2xl" />
      ))}
    </div>
  );
}
