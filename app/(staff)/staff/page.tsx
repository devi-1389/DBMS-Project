import type { Metadata } from "next";
import { Suspense } from "react";

import { Protected } from "@/components/auth/protected";
import { PageHeader } from "@/components/layout/page-header";
import { StaffSchedule, StaffScheduleSkeleton } from "@/components/staff/staff-schedule";
import type { Viewer } from "@/lib/auth/types";
import { getDb } from "@/lib/db";
import { addDays, resortDayWindow, toDateKey } from "@/lib/format";
import { getStaffSchedule } from "@/lib/dal/staff";
import { ROUTES } from "@/lib/navigation";

export const metadata: Metadata = { title: "Staff schedule" };

const WINDOW_DAYS = 30;

export default function StaffPage() {
  return (
    <>
      <PageHeader
        size="compact"
        eyebrow="Team"
        title="My sessions"
        description={`Your assigned sessions for the next ${WINDOW_DAYS} days, with the guests on each one.`}
      />
      <Suspense fallback={<StaffScheduleSkeleton />}>
        <Protected area="staff" returnTo={ROUTES.staff}>
          {(viewer) => <StaffContent viewer={viewer} />}
        </Protected>
      </Suspense>
    </>
  );
}

async function StaffContent({ viewer }: { viewer: Viewer }) {
  const today = toDateKey(new Date().toISOString());
  const { from, to } = resortDayWindow(today, addDays(today, WINDOW_DAYS - 1));
  // Staff only ever receive their own assignments; administrators see every assignment.
  const sessions = await getStaffSchedule(getDb(), viewer, { from, to });
  return <StaffSchedule sessions={sessions} showStaff={viewer.role === "admin"} hasStaffRecord={Boolean(viewer.staffId)} />;
}
