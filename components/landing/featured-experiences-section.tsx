import { Suspense } from "react";

import { ExperienceExplorer, ExperienceExplorerView } from "@/components/landing/experience-explorer";
import { SectionHeading } from "@/components/landing/section-heading";
import { SECTION_IDS } from "@/lib/navigation";
import type { ExperienceSummary } from "@/lib/types/experience";

export function FeaturedExperiencesSection({ experiences }: { experiences: ExperienceSummary[] }) {
  return (
    <section
      id={SECTION_IDS.experiences}
      aria-labelledby="experiences-title"
      className="scroll-mt-20 border-y bg-ivory-200/60 py-24 sm:py-32"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <SectionHeading
          id="experiences-title"
          eyebrow="Featured experiences"
          title="Moments worth travelling for"
          description="A first look at what a stay can hold, from a private lakeside dinner to a summit at sunrise."
        />
        <Suspense fallback={<ExperienceExplorerView experiences={experiences} category={null} />}>
          <ExperienceExplorer experiences={experiences} />
        </Suspense>
      </div>
    </section>
  );
}
