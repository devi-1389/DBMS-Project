import Link from "next/link";

import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatPrice, formatTimeRange } from "@/lib/format";
import { experienceHref } from "@/lib/navigation";
import type { BookingSummary } from "@/lib/types/booking";

/** Table on wide screens, stacked cards on small ones. */
export function BookingsTable({
  bookings,
  showGuest = false,
  actions,
  detailHref,
  caption,
}: {
  bookings: BookingSummary[];
  showGuest?: boolean;
  actions?: (booking: BookingSummary) => React.ReactNode;
  /** Links each reference to its (ownership-checked) detail page. */
  detailHref?: (booking: BookingSummary) => string;
  caption: string;
}) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border bg-card shadow-sm md:block">
        <Table>
          <caption className="sr-only">{caption}</caption>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              {showGuest && <TableHead>Guest</TableHead>}
              <TableHead>Experience</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Guests</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              {actions && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((booking) => (
              <TableRow key={booking.reference}>
                <TableCell className="font-mono text-xs font-semibold">
                  {detailHref ? (
                    <Link href={detailHref(booking)} className="hover:underline hover:underline-offset-4">
                      {booking.reference}
                    </Link>
                  ) : (
                    booking.reference
                  )}
                </TableCell>
                {showGuest && <TableCell>{booking.guestName}</TableCell>}
                <TableCell>
                  <Link href={experienceHref(booking.experienceSlug)} className="font-semibold hover:underline hover:underline-offset-4">
                    {booking.experienceTitle}
                  </Link>
                </TableCell>
                <TableCell>
                  <span className="block font-medium">{formatDate(booking.startsAt)}</span>
                  <span className="text-xs text-muted-foreground">{formatTimeRange(booking.startsAt, booking.endsAt)}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{booking.partySize}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatPrice(booking.totalMinor, booking.currency)}
                </TableCell>
                <TableCell>
                  <BookingStatusBadge status={booking.status} />
                </TableCell>
                {actions && <TableCell className="text-right">{actions(booking)}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-3 md:hidden" aria-label={caption}>
        {bookings.map((booking) => (
          <li key={booking.reference} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs font-semibold text-muted-foreground">{booking.reference}</p>
                <Link
                  href={experienceHref(booking.experienceSlug)}
                  className="mt-1 block font-display text-xl leading-tight font-semibold"
                >
                  {booking.experienceTitle}
                </Link>
              </div>
              <BookingStatusBadge status={booking.status} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Date</dt>
                <dd className="font-medium">{formatDate(booking.startsAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Time</dt>
                <dd className="font-medium">{formatTimeRange(booking.startsAt, booking.endsAt)}</dd>
              </div>
              {showGuest && (
                <div>
                  <dt className="text-xs text-muted-foreground">Guest</dt>
                  <dd className="font-medium">{booking.guestName}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-muted-foreground">Guests</dt>
                <dd className="font-medium">{booking.partySize}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Total</dt>
                <dd className="font-semibold">{formatPrice(booking.totalMinor, booking.currency)}</dd>
              </div>
            </dl>
            {actions && <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">{actions(booking)}</div>}
          </li>
        ))}
      </ul>
    </>
  );
}
