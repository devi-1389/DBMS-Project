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
import { getPlan, listPlans } from "@/lib/dal/itinerary";
import { suggestDaysForPlan } from "@/lib/dal/planner";
import { getPreferences } from "@/lib/dal/preferences";
import { resortDayWindow } from "@/lib/format";
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
    ? resortDayWindow(stay.arrival!, stay.departure!)
    : { from: now, to: new Date(now.getTime() + 90 * 86_400_000) };
  const bookings = await listGuestBookingsBetween(db, viewer.userId, bookingWindow.from, bookingWindow.to);

  // LUXE-ECO day planner: fill the stay's days within the remaining activity budget.
  const suggestions = plan && stay ? await suggestDaysForPlan(db, plan, preferences, now) : null;

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
