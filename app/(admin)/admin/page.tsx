import type { Metadata } from "next";

import { AdminConsole } from "@/components/admin/admin-console";
import { NewExperienceDialog } from "@/components/admin/new-experience-dialog";
import { PreviewNotice } from "@/components/common/preview-notice";
import { PageHeader } from "@/components/layout/page-header";
// PLACEHOLDER data until the DAL exists (Phase 5).
import { listExperiences, listSampleBookings, listSlots } from "@/lib/placeholder/catalogue";

export const metadata: Metadata = { title: "Admin console" };

export default async function AdminPage() {
  const [experiences, slots, bookings] = await Promise.all([listExperiences(), listSlots(), listSampleBookings()]);

  return (
    <div className="mx-auto max-w-7xl px-6 pt-8 pb-24 lg:px-10">
      <PreviewNotice title="Admin preview">
        Access control isn&apos;t enforced yet (Phase 3), so this page is open to anyone. All figures come from sample
        data and nothing here can be saved.
      </PreviewNotice>
      <PageHeader
        eyebrow="Operations"
        title="Admin console"
        description="Experiences, sessions and bookings across the resort."
        actions={<NewExperienceDialog />}
        className="pt-10"
      />
      <AdminConsole experiences={experiences} slots={slots} bookings={bookings} />
    </div>
  );
}
