import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Info, SearchX } from "lucide-react";

import { Protected } from "@/components/auth/protected";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { MatchListSkeleton } from "@/components/preferences/match-card";
import { RecommendationCard } from "@/components/recommendations/recommendation-card";
import { RecommendationFiltersForm } from "@/components/recommendations/recommendation-filters";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { Viewer } from "@/lib/auth/types";
import { getDb } from "@/lib/db";
import { listCatalogue } from "@/lib/dal/catalogue";
import { getPlan, listPlans } from "@/lib/dal/itinerary";
import { getPreferences } from "@/lib/dal/preferences";
import { formatDateKey } from "@/lib/format";
import { defaultFilters, filterWindow, parseFilters } from "@/lib/matching/filters";
import { EXCLUSION_LABELS, recommendExperiences, type ExclusionReason } from "@/lib/matching/recommend";
import { ROUTES } from "@/lib/navigation";
import { DEFAULT_PREFERENCES } from "@/lib/preferences";

export const metadata: Metadata = { title: "Recommendations" };

export default function RecommendationsPage({ searchParams }: PageProps<"/recommendations">) {
  return (
    <>
      <PageHeader
        size="compact"
        eyebrow="Personalised matching"
        title="Recommended for you"
        description="Ranked from sessions in our schedule, using your saved preferences. Open “Why this score” on any card to see every factor."
      />
      <Suspense fallback={<MatchListSkeleton count={4} />}>
        <Protected area="guest" returnTo={ROUTES.recommendations}>
          {(viewer) => <RecommendationsContent viewer={viewer} searchParams={searchParams} />}
        </Protected>
      </Suspense>
    </>
  );
}

async function RecommendationsContent({
  viewer,
  searchParams,
}: {
  viewer: Viewer;
  searchParams: PageProps<"/recommendations">["searchParams"];
}) {
  const params = await searchParams;
  const db = getDb();
  const now = new Date();

  const saved = await getPreferences(db, viewer.userId);
  const preferences = saved ?? DEFAULT_PREFERENCES;
  const plans = await listPlans(db, viewer.userId);
  const requestedPlan = typeof params.plan === "string" ? plans.find((plan) => plan.id === params.plan) : undefined;
  const planSummary = requestedPlan ?? plans[0];
  const plan = planSummary ? await getPlan(db, viewer.userId, planSummary.id) : null;

  const filters = parseFilters(params, defaultFilters(preferences, plan, now));
  const catalogue = await listCatalogue(db, filterWindow(filters));
  const { recommendations, excluded } = recommendExperiences({
    ...catalogue,
    preferences,
    filters,
    planned: plan?.items ?? [],
    now,
    limit: 8,
  });
  const exclusions = Object.entries(excluded) as [ExclusionReason, number][];

  return (
    <div className="space-y-6">
      {!saved && (
        <Alert>
          <Info aria-hidden="true" />
          <AlertTitle>These aren&apos;t personal yet</AlertTitle>
          <AlertDescription>
            <p>
              You haven&apos;t saved preferences, so scores only use pace, dates and availability.{" "}
              <Link href={ROUTES.preferences} className="font-semibold text-foreground underline underline-offset-4">
                Set your preferences
              </Link>
            </p>
          </AlertDescription>
        </Alert>
      )}

      <RecommendationFiltersForm filters={filters} plans={plans} planId={requestedPlan?.id} />

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {recommendations.length} recommendation{recommendations.length === 1 ? "" : "s"} for {formatDateKey(filters.from)} –{" "}
        {formatDateKey(filters.to)}, {filters.partySize} guest{filters.partySize === 1 ? "" : "s"}
        {plan ? ` · adding to “${plan.name}”` : " · sessions you add go into a new plan"}.
      </p>

      {recommendations.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Nothing fits these filters"
          description="Try a wider date range, a smaller group, a higher budget or a different time of day."
        >
          <Button asChild variant="outline">
            <Link href={ROUTES.recommendations}>Reset filters</Link>
          </Button>
        </EmptyState>
      ) : (
        <ol className="space-y-5">
          {recommendations.map((recommendation, index) => (
            <li key={recommendation.experience.slug}>
              <RecommendationCard
                recommendation={recommendation}
                rank={index + 1}
                partySize={filters.partySize}
                planId={plan?.id}
              />
            </li>
          ))}
        </ol>
      )}

      {exclusions.length > 0 && (
        <section aria-labelledby="hidden-title" className="rounded-2xl border border-dashed px-5 py-4 text-sm">
          <h2 id="hidden-title" className="font-semibold">
            Why some experiences aren&apos;t shown
          </h2>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {exclusions.map(([reason, count]) => (
              <li key={reason}>
                {count} {count === 1 ? "experience" : "experiences"} {EXCLUSION_LABELS[reason]}.
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
