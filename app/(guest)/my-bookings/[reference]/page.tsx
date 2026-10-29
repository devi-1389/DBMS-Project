import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Users } from "lucide-react";

import { Protected } from "@/components/auth/protected";
import { ManageBooking } from "@/components/booking/manage-booking";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { Breadcrumbs } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { Viewer } from "@/lib/auth/types";
import { getDb } from "@/lib/db";
import { getBookingForViewer } from "@/lib/dal/bookings";
import { BOOKING_POLICY, isActiveBooking, isChangeable } from "@/lib/bookings";
import { formatDate, formatPrice, formatTime, formatTimeRange } from "@/lib/format";
import { experienceHref, ROUTES } from "@/lib/navigation";

export const metadata: Metadata = { title: "Booking" };

const PAYMENT_METHOD = { pay_at_resort: "Pay at resort", card: "Card" } as const;

export default function BookingPage({ params }: PageProps<"/my-bookings/[reference]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <Protected area="guest" returnTo={ROUTES.myBookings}>
        {(viewer) => <BookingContent viewer={viewer} params={params} />}
      </Protected>
    </Suspense>
  );
}

async function BookingContent({
  viewer,
  params,
}: {
  viewer: Viewer;
  params: PageProps<"/my-bookings/[reference]">["params"];
}) {
  const { reference } = await params;
  // Ownership is enforced in the query: not yours (and not your session as staff)
  // looks exactly like a booking that doesn't exist.
  const booking = await getBookingForViewer(getDb(), viewer, decodeURIComponent(reference));
  if (!booking) notFound();

  const now = new Date();
  const changeable = isChangeable(booking, now);
  const deadline = new Date(Date.parse(booking.startsAt) - BOOKING_POLICY.changeHours * 3_600_000).toISOString();
  const isAdmin = viewer.role === "admin";

  return (
    <article className="space-y-8">
      <Breadcrumbs items={[{ label: "My bookings", href: ROUTES.myBookings }, { label: booking.reference }]} />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm font-semibold text-gold-700">{booking.reference}</p>
          <h1 className="mt-2 font-display text-4xl leading-tight font-medium sm:text-5xl">
            <Link href={experienceHref(booking.experienceSlug)} className="hover:underline hover:underline-offset-4">
              {booking.experienceTitle}
            </Link>
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            {formatDate(booking.startsAt)} · {formatTimeRange(booking.startsAt, booking.endsAt)}
          </p>
          {!booking.ownedByViewer && (
            <p className="mt-2 text-sm text-muted-foreground">Guest: {booking.guestName} (shown for your role)</p>
          )}
        </div>
        <BookingStatusBadge status={booking.status} className="text-sm" />
      </header>

      <dl className="grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-3">
        <div className="bg-card p-5">
          <dt className="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            <Users className="size-4" aria-hidden="true" />
            Guests
          </dt>
          <dd className="mt-1 font-semibold">{booking.partySize}</dd>
        </div>
        <div className="bg-card p-5">
          <dt className="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            <MapPin className="size-4" aria-hidden="true" />
            Meeting point
          </dt>
          <dd className="mt-1 font-semibold">{booking.meetingPoint}</dd>
        </div>
        <div className="bg-card p-5">
          <dt className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Total</dt>
          <dd className="mt-1 font-display text-2xl font-semibold">{formatPrice(booking.totalMinor, booking.currency)}</dd>
        </div>
      </dl>

      <div className="grid gap-6 md:grid-cols-2">
        <section aria-labelledby="history-title" className="rounded-2xl border bg-card p-6">
          <h2 id="history-title" className="font-display text-2xl font-semibold">
            Status history
          </h2>
          <ol className="mt-4 space-y-3 text-sm">
            {booking.history.map((entry, index) => (
              <li key={index} className="flex items-center justify-between gap-3">
                <span>
                  {entry.from ? `${entry.from.replace("_", " ")} → ` : "Created as "}
                  <strong>{entry.to.replace("_", " ")}</strong>
                </span>
                <span className="text-muted-foreground">{formatDate(entry.changedAt)}</span>
              </li>
            ))}
          </ol>
        </section>
        <section aria-labelledby="payments-title" className="rounded-2xl border bg-card p-6">
          <h2 id="payments-title" className="font-display text-2xl font-semibold">
            Payments
          </h2>
          {booking.payments.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <ul className="mt-4 space-y-3 text-sm">
              {booking.payments.map((payment, index) => (
                <li key={index} className="flex items-center justify-between gap-3">
                  <span>
                    {PAYMENT_METHOD[payment.method]} · {payment.status}
                  </span>
                  <span className="font-semibold">{formatPrice(payment.amountMinor, booking.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {isActiveBooking(booking.status) && (booking.ownedByViewer || isAdmin) ? (
        <ManageBooking
          reference={booking.reference}
          title={`${booking.experienceTitle}, ${formatDate(booking.startsAt)} at ${formatTime(booking.startsAt)}`}
          partySize={booking.partySize}
          maxPartySize={booking.maxPartySize}
          canChangeGuests={booking.ownedByViewer && changeable}
          canCancel={changeable || isAdmin}
          deadline={`${formatDate(deadline)}, ${formatTime(deadline)}`}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Payment is taken at the resort. Contact the resort team for anything urgent.</p>
      )}
    </article>
  );
}
