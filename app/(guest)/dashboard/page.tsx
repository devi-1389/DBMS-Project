import type { Metadata } from "next";
import Link from "next/link";
import { Compass } from "lucide-react";

import { DashboardView } from "@/components/dashboard/dashboard-view";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/navigation";
// PLACEHOLDER data until the DAL exists (Phase 5).
import { listExperiences, listSlots } from "@/lib/placeholder/catalogue";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [experiences, slots] = await Promise.all([listExperiences(), listSlots()]);

  return (
    <>
      <PageHeader
        size="compact"
        eyebrow="Your stay"
        title="Welcome to your stay planner"
        description="Your matches, plans and bookings in one place."
        actions={
          <Button asChild>
            <Link href={ROUTES.experiences}>
              <Compass />
              Explore experiences
            </Link>
          </Button>
        }
      />
      <DashboardView experiences={experiences} slots={slots} />
    </>
  );
}
