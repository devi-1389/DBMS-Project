"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Compass, Route, SlidersHorizontal, Sparkles, Ticket, Wallet } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { StatCard } from "@/components/common/stat-card";
import { MatchCard, MatchListSkeleton } from "@/components/preferences/match-card";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatPrice, formatTimeRange } from "@/lib/format";
import { INTEREST_LABELS } from "@/lib/interests";
import { itineraryTotal } from "@/lib/itinerary";
import { rankExperiences } from "@/lib/matching/score";
import { experienceHref, ROUTES } from "@/lib/navigation";
import { itineraryStore, preferencesStore, usePreviewStore } from "@/lib/preview-store";
import type { ExperienceSlot, ExperienceSummary } from "@/lib/types/experience";

export function DashboardView({ experiences, slots }: { experiences: ExperienceSummary[]; slots: ExperienceSlot[] }) {
  const [preferences] = usePreviewStore(preferencesStore);
  const [itinerary] = usePreviewStore(itineraryStore);
  const matches = useMemo(
    () => (preferences ? rankExperiences(experiences, slots, preferences, 3) : []),
    [experiences, slots, preferences],
  );

  if (preferences === undefined || itinerary === undefined) return <DashboardSkeleton />;

  const upcoming = itinerary.items.slice(0, 4);
  const total = itineraryTotal(itinerary.items);

  return (
    <div className="space-y-10">
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Summary">
        <li>
          <StatCard icon={Route} label="Itinerary sessions" value={itinerary.items.length} hint="Planned, not reserved" />
        </li>
        <li>
          <StatCard
            icon={Wallet}
            label="Plan estimate"
            value={formatPrice(total, itinerary.items[0]?.currency)}
            hint="Sample prices"
          />
        </li>
        <li>
          <StatCard icon={Ticket} label="Confirmed bookings" value={0} hint="Online booking coming soon" />
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
            {preferences && (
              <CardAction>
                <Button asChild variant="link" size="sm">
                  <Link href={ROUTES.preferences}>Edit</Link>
                </Button>
              </CardAction>
            )}
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
            ) : matches.length === 0 ? (
              <EmptyState
                icon={Compass}
                title="No matches with these settings"
                description="Try a higher pace or a larger budget."
                className="py-10"
              >
                <Button asChild variant="outline">
                  <Link href={ROUTES.preferences}>Adjust preferences</Link>
                </Button>
              </EmptyState>
            ) : (
              <ol className="space-y-4">
                {matches.map((match, index) => (
                  <li key={match.experience.slug}>
                    <MatchCard match={match} rank={index + 1} />
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
              <CardDescription>From your itinerary draft.</CardDescription>
              {upcoming.length > 0 && (
                <CardAction>
                  <Button asChild variant="link" size="sm">
                    <Link href={ROUTES.itinerary}>View all</Link>
                  </Button>
                </CardAction>
              )}
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <EmptyState
                  icon={Route}
                  title="Nothing planned yet"
                  description="Add sessions from any experience page."
                  className="py-10"
                >
                  <Button asChild variant="outline">
                    <Link href={ROUTES.experiences}>Browse experiences</Link>
                  </Button>
                </EmptyState>
              ) : (
                <ul className="divide-y">
                  {upcoming.map((item) => (
                    <li key={item.slotId} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <Link
                          href={experienceHref(item.experienceSlug)}
                          className="block truncate font-semibold hover:underline hover:underline-offset-4"
                        >
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
                You have no bookings. Online booking isn&apos;t available in this preview.
              </CardDescription>
            </CardHeader>
            <CardContent>
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

function DashboardSkeleton() {
  return (
    <div className="space-y-10" role="status" aria-label="Loading dashboard">
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
