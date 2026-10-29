import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { PreferencesPlanner } from "@/components/preferences/preferences-planner";
// PLACEHOLDER data until the DAL exists (Phase 5).
import { listExperiences, listSlots } from "@/lib/placeholder/catalogue";

export const metadata: Metadata = { title: "Preferences" };

export default async function PreferencesPage() {
  const [experiences, slots] = await Promise.all([listExperiences(), listSlots()]);

  return (
    <>
      <PageHeader
        size="compact"
        eyebrow="Personalised matching"
        title="Your travel preferences"
        description="Tell us how you like to spend your days and we'll rank every experience around you, with reasons."
      />
      <PreferencesPlanner experiences={experiences} slots={slots} />
    </>
  );
}
