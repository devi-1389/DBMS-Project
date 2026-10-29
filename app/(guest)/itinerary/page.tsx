import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Compass } from "lucide-react";

import { Protected } from "@/components/auth/protected";
import { ItineraryWorkspace } from "@/components/itinerary/itinerary-workspace";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Viewer } from "@/lib/auth/types";
import { getDb } from "@/lib/db";
import { listGuestBookingsBetween } from "@/lib/dal/bookings";
import { listCatalogue } from "@/lib/dal/catalogue";
import { getPlan, listPlans } from "@/lib/dal/itinerary";
import { getPreferences } from "@/lib/dal/preferences";
import { addDays } from "@/lib/format";
import { defaultFilters, filterWindow } from "@/lib/matching/filters";
import { recommendExperiences, suggestItinerary } from "@/lib/matching/recommend";
import { ROUTES } from "@/lib/navigation";
import { DEFAULT_PREFERENCES } from "@/lib/preferences";

export const metadata: Metadata = { title: "Itinerary" };

export default function ItineraryPage({ searchParams }: PageProps<"/itinerary">) {
  return (
    <>
      <PageHeader
        size="compact"
        eyebrow="Itinerary"
        title="Plan your days"
        description="Arrange sessions across your stay and spot overlaps before you book. Plans are saved to your account; they're not reservations."
        actions={
          <Button asChild variant="outline">
            <Link href={ROUTES.recommendations}>
              <Compass />
              Find sessions
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<ItinerarySkeleton />}>
        <Protected area="guest" returnTo={ROUTES.itinerary}>
          {(viewer) => <ItineraryContent viewer={viewer} searchParams={searchParams} />}
        </Protected>
      </Suspense>
    </>
  );
}

async function ItineraryContent({
  viewer,
  searchParams,
}: {
  viewer: Viewer;
  searchParams: PageProps<"/itinerary">["searchParams"];
}) {
  const params = await searchParams;
  const db = getDb();
  const now = new Date();

  const plans = await listPlans(db, viewer.userId);
  const selected = plans.find((plan) => plan.id === params.plan) ?? plans[0];
  const plan = selected ? await getPlan(db, viewer.userId, selected.id) : null;
  const preferences = (await getPreferences(db, viewer.userId)) ?? DEFAULT_PREFERENCES;

  // Confirmed bookings are shown alongside, never mixed into the plan.
  const stay = plan?.arrival && plan.departure ? plan : null;
  const bookingWindow = stay
    ? { from: new Date(`${stay.arrival}T00:00:00.000Z`), to: new Date(`${addDays(stay.departure!, 1)}T00:00:00.000Z`) }
    : { from: now, to: new Date(now.getTime() + 90 * 86_400_000) };
  const bookings = await listGuestBookingsBetween(db, viewer.userId, bookingWindow.from, bookingWindow.to);

  let suggestions: ReturnType<typeof suggestItinerary> = [];
  if (stay) {
    const filters = defaultFilters(preferences, stay, now);
    const catalogue = await listCatalogue(db, filterWindow(filters));
    const { recommendations } = recommendExperiences({
      ...catalogue,
      preferences,
      filters,
      planned: plan!.items,
      now,
      limit: 12,
    });
    suggestions = suggestItinerary({ recommendations, planned: plan!.items, perDay: 2, limit: 5 });
  }

  return (
    <ItineraryWorkspace
      plans={plans}
      plan={plan}
      bookings={bookings}
      suggestions={suggestions}
      partySize={preferences.groupSize}
    />
  );
}

function ItinerarySkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading itinerary">
      <Skeleton className="h-9 w-80 rounded-full" />
      <Skeleton className="h-36 rounded-2xl" />
      <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-72 rounded-3xl" />
      </div>
    </div>
  );
}
