import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Compass } from "lucide-react";

import { Protected } from "@/components/auth/protected";
import { DashboardSkeleton, DashboardView } from "@/components/dashboard/dashboard-view";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import type { Viewer } from "@/lib/auth/types";
import { getDb } from "@/lib/db";
import { listGuestBookings } from "@/lib/dal/bookings";
import { listCatalogue } from "@/lib/dal/catalogue";
import { getPlan, listPlans } from "@/lib/dal/itinerary";
import { getPreferences } from "@/lib/dal/preferences";
import { defaultFilters, filterWindow } from "@/lib/matching/filters";
import { recommendExperiences } from "@/lib/matching/recommend";
import { ROUTES } from "@/lib/navigation";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        size="compact"
        eyebrow="Your stay"
        title="Your stay planner"
        description="Recommendations, plans and bookings in one place."
        actions={
          <Button asChild>
            <Link href={ROUTES.experiences}>
              <Compass />
              Explore experiences
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <Protected area="guest" returnTo={ROUTES.dashboard}>
          {(viewer) => <DashboardContent viewer={viewer} />}
        </Protected>
      </Suspense>
    </>
  );
}

async function DashboardContent({ viewer }: { viewer: Viewer }) {
  const db = getDb();
  const now = new Date();
  const preferences = await getPreferences(db, viewer.userId);
  const plans = await listPlans(db, viewer.userId);
  const plan = plans[0] ? await getPlan(db, viewer.userId, plans[0].id) : null;
  const bookings = await listGuestBookings(db, viewer.userId);

  let recommendations: ReturnType<typeof recommendExperiences>["recommendations"] = [];
  if (preferences) {
    const filters = defaultFilters(preferences, plan, now);
    const catalogue = await listCatalogue(db, filterWindow(filters));
    recommendations = recommendExperiences({
      ...catalogue,
      preferences,
      filters,
      planned: plan?.items ?? [],
      now,
      limit: 3,
    }).recommendations;
  }

  return (
    <DashboardView
      firstName={viewer.displayName.split(" ")[0] || "there"}
      preferences={preferences}
      plan={plan}
      bookings={bookings}
      recommendations={recommendations}
      now={now}
    />
  );
}
