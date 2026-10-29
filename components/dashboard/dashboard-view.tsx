import Link from "next/link";
import { ArrowRight, CalendarDays, Compass, Route, SlidersHorizontal, Sparkles, Ticket, Wallet } from "lucide-react";

import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { StatCard } from "@/components/common/stat-card";
import { AddToPlanButton } from "@/components/itinerary/add-to-plan-button";
import { MatchCard, MatchListSkeleton } from "@/components/preferences/match-card";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAmount, formatDate, formatTimeRange } from "@/lib/format";
import { INTEREST_LABELS } from "@/lib/interests";
import { itineraryTotal } from "@/lib/itinerary";
import type { Recommendation } from "@/lib/matching/recommend";
import { bookingHref, experienceHref, ROUTES } from "@/lib/navigation";
import type { BookingSummary } from "@/lib/types/booking";
import type { GuestPreferences, ItineraryPlan } from "@/lib/types/guest";

/** Server-rendered dashboard. Everything here comes from the database. */
export function DashboardView({
  firstName,
  preferences,
  plan,
  bookings,
  recommendations,
  now,
}: {
  firstName: string;
  preferences: GuestPreferences | null;
  plan: ItineraryPlan | null;
  bookings: BookingSummary[];
  recommendations: Recommendation[];
  now: Date;
}) {
  const upcomingPlan = (plan?.items ?? []).filter((item) => Date.parse(item.startsAt) > now.getTime()).slice(0, 4);
  const upcomingBookings = bookings.filter(
    (booking) => (booking.status === "confirmed" || booking.status === "pending") && Date.parse(booking.startsAt) > now.getTime(),
  );

  return (
    <div className="space-y-10">
      <p className="font-display text-3xl">Good to see you, {firstName}.</p>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Summary">
        <li>
          <StatCard icon={Route} label="Planned sessions" value={plan?.items.length ?? 0} hint={plan ? `In “${plan.name}”` : "No plan yet"} />
        </li>
        <li>
          <StatCard
            icon={Wallet}
            label="Plan estimate"
            value={formatAmount(itineraryTotal(plan?.items ?? []), plan?.currency)}
            hint="Planned, not booked"
          />
        </li>
        <li>
          <StatCard icon={Ticket} label="Upcoming bookings" value={upcomingBookings.length} hint="Confirmed or pending" />
        </li>
        <li>
          <StatCard
            icon={SlidersHorizontal}
            label="Preferences"
            value={preferences ? "Set" : "Not set"}
            hint={preferences ? `${preferences.interests.length} interests` : "Takes two minutes"}
          />
        </li>
      </ul>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-2xl">
              <Sparkles className="size-5 text-gold-600" aria-hidden="true" />
              Recommended for you
            </CardTitle>
            <CardDescription>
              {preferences
                ? `Based on ${preferences.interests.map((id) => INTEREST_LABELS[id].toLowerCase()).slice(0, 3).join(", ")}${preferences.interests.length > 3 ? " and more" : ""}.`
                : "Set your preferences to see personal matches."}
            </CardDescription>
            <CardAction>
              <Button asChild variant="link" size="sm">
                <Link href={ROUTES.recommendations}>See all</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {!preferences ? (
              <EmptyState
                icon={SlidersHorizontal}
                title="Tell us what you love"
                description="Choose interests, pace and budget, and we'll rank every experience for you."
                className="py-10"
              >
                <Button asChild>
                  <Link href={ROUTES.preferences}>Set preferences</Link>
                </Button>
              </EmptyState>
            ) : recommendations.length === 0 ? (
              <EmptyState
                icon={Compass}
                title="No matches in the next month"
                description="Try different dates or filters on the recommendations page."
                className="py-10"
              >
                <Button asChild variant="outline">
                  <Link href={ROUTES.recommendations}>Adjust filters</Link>
                </Button>
              </EmptyState>
            ) : (
              <ol className="space-y-4">
                {recommendations.map((match, index) => (
                  <li key={match.experience.slug}>
                    <MatchCard
                      match={match}
                      rank={index + 1}
                      action={
                        match.sessions[0] && (
                          <AddToPlanButton slotId={match.sessions[0].id} partySize={preferences.groupSize} planId={plan?.id} label={`Plan ${formatDate(match.sessions[0].startsAt)}`} />
                        )
                      }
                    />
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-2xl">
                <CalendarDays className="size-5 text-gold-600" aria-hidden="true" />
                Up next in your plan
              </CardTitle>
              <CardDescription>Planned sessions aren&apos;t reserved.</CardDescription>
              <CardAction>
                <Button asChild variant="link" size="sm">
                  <Link href={ROUTES.itinerary}>Open plan</Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {upcomingPlan.length === 0 ? (
                <EmptyState icon={Route} title="Nothing planned yet" description="Add sessions from recommendations." className="py-10" />
              ) : (
                <ul className="divide-y">
                  {upcomingPlan.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <Link href={experienceHref(item.experienceSlug)} className="block truncate font-semibold hover:underline hover:underline-offset-4">
                          {item.title}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(item.startsAt)} · {formatTimeRange(item.startsAt, item.endsAt)}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm text-muted-foreground">
                        {item.partySize} guest{item.partySize > 1 ? "s" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-2xl">
                <Ticket className="size-5 text-gold-600" aria-hidden="true" />
                Bookings
              </CardTitle>
              <CardDescription>
                {upcomingBookings.length ? "Your next confirmed sessions." : "You have no upcoming bookings."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {upcomingBookings.slice(0, 3).map((booking) => (
                <div key={booking.reference} className="flex items-center justify-between gap-3">
                  <Link href={bookingHref(booking.reference)} className="min-w-0 truncate font-semibold hover:underline">
                    {booking.experienceTitle}
                  </Link>
                  <BookingStatusBadge status={booking.status} />
                </div>
              ))}
              <Button asChild variant="outline" className="w-full">
                <Link href={ROUTES.myBookings}>
                  Go to my bookings
                  <ArrowRight />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-10" role="status" aria-label="Loading dashboard">
      <Skeleton className="h-9 w-72" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border bg-card p-6">
          <Skeleton className="mb-6 h-7 w-56" />
          <MatchListSkeleton />
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  );
}
