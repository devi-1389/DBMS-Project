import type { Metadata } from "next";
import Link from "next/link";
import { Compass } from "lucide-react";

import { ItineraryPlanner } from "@/components/itinerary/itinerary-planner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/navigation";
// PLACEHOLDER data until the DAL exists (Phase 5).
import { listExperiences, SAMPLE_WINDOW } from "@/lib/placeholder/catalogue";

export const metadata: Metadata = { title: "Itinerary" };

export default async function ItineraryPage() {
  const experiences = await listExperiences();

  return (
    <>
      <PageHeader
        size="compact"
        eyebrow="Itinerary draft"
        title="Plan your days"
        description="Arrange sessions across your stay and spot overlaps before you book. This is a plan, not a reservation."
        actions={
          <Button asChild variant="outline">
            <Link href={ROUTES.experiences}>
              <Compass />
              Add experiences
            </Link>
          </Button>
        }
      />
      <ItineraryPlanner experiences={experiences} season={SAMPLE_WINDOW} />
    </>
  );
}
