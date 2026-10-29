import type { Metadata } from "next";
import { Suspense } from "react";

import { CatalogueExplorer, CatalogueView } from "@/components/experiences/catalogue-explorer";
import { PageHeader } from "@/components/layout/page-header";
import { DEFAULT_FILTERS } from "@/lib/catalogue-filters";
import { ROUTES } from "@/lib/navigation";
// PLACEHOLDER data until the DAL exists (Phase 5).
import { listExperiences, listSlots, SAMPLE_WINDOW } from "@/lib/placeholder/catalogue";

export const metadata: Metadata = {
  title: "Experiences",
  description: "Browse luxury, nature, adventure, wellness, local and sustainability experiences at SOLACE.",
};

export default async function ExperiencesPage() {
  const [experiences, slots] = await Promise.all([listExperiences(), listSlots()]);
  const dateRange = { min: SAMPLE_WINDOW.start, max: SAMPLE_WINDOW.end };

  return (
    <div className="mx-auto max-w-7xl px-6 pb-24 lg:px-10">
      <PageHeader
        breadcrumbs={[{ label: "Home", href: ROUTES.home }, { label: "Experiences" }]}
        eyebrow="Experiences"
        title="Find your experience"
        description="Filter by feeling, pace, price or date. Every session shown is from a sample season, so availability is illustrative."
      />
      <Suspense
        fallback={
          <CatalogueView experiences={experiences} slots={slots} dateRange={dateRange} filters={DEFAULT_FILTERS} />
        }
      >
        <CatalogueExplorer experiences={experiences} slots={slots} dateRange={dateRange} />
      </Suspense>
    </div>
  );
}
