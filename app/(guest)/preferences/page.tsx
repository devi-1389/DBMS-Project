import type { Metadata } from "next";
import { Suspense } from "react";

import { Protected } from "@/components/auth/protected";
import { PageHeader } from "@/components/layout/page-header";
import { MatchListSkeleton } from "@/components/preferences/match-card";
import { PreferencesPlanner } from "@/components/preferences/preferences-planner";
import { Skeleton } from "@/components/ui/skeleton";
import type { Viewer } from "@/lib/auth/types";
import { getDb } from "@/lib/db";
import { listCatalogue } from "@/lib/dal/catalogue";
import { getPreferences } from "@/lib/dal/preferences";
import { ROUTES } from "@/lib/navigation";
import { DEFAULT_PREFERENCES } from "@/lib/preferences";

export const metadata: Metadata = { title: "Preferences" };

export default function PreferencesPage() {
  return (
    <>
      <PageHeader
        size="compact"
        eyebrow="Personalised matching"
        title="Your travel preferences"
        description="Tell us how you like to spend your days. We save them to your account and rank every experience around you, with reasons."
      />
      <Suspense fallback={<PreferencesSkeleton />}>
        <Protected area="guest" returnTo={ROUTES.preferences}>
          {(viewer) => <PreferencesContent viewer={viewer} />}
        </Protected>
      </Suspense>
    </>
  );
}

async function PreferencesContent({ viewer }: { viewer: Viewer }) {
  const db = getDb();
  const now = new Date();
  const saved = await getPreferences(db, viewer.userId);
  // Sessions over the next 60 days feed the live "top matches" preview.
  const catalogue = await listCatalogue(db, { from: now, to: new Date(now.getTime() + 60 * 86_400_000) });

  return (
    <PreferencesPlanner
      experiences={catalogue.experiences}
      slots={catalogue.slots}
      initial={saved ?? DEFAULT_PREFERENCES}
      saved={Boolean(saved)}
      now={now.toISOString()}
    />
  );
}

function PreferencesSkeleton() {
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_24rem] lg:gap-14" role="status" aria-label="Loading preferences">
      <div className="space-y-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border bg-card p-7">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="mt-3 h-4 w-72" />
            <div className="mt-6 flex flex-wrap gap-2">
              {Array.from({ length: 6 }, (_, j) => (
                <Skeleton key={j} className="h-10 w-28 rounded-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <MatchListSkeleton />
    </div>
  );
}
