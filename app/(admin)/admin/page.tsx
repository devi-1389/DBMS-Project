import type { Metadata } from "next";
import { Suspense } from "react";

import { AdminConsole } from "@/components/admin/admin-console";
import { NewExperienceDialog } from "@/components/admin/new-experience-dialog";
import { Protected } from "@/components/auth/protected";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { Viewer } from "@/lib/auth/types";
import { getDb } from "@/lib/db";
import { getAdminConsoleData } from "@/lib/dal/admin";
import { ROUTES } from "@/lib/navigation";

export const metadata: Metadata = { title: "Admin console" };

const WINDOW_DAYS = 60;

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 pt-8 pb-24 lg:px-10">
      <PageHeader
        eyebrow="Operations"
        title="Admin console"
        description="Experiences, sessions, bookings and team roles across the resort."
        actions={<NewExperienceDialog />}
      />
      <Suspense fallback={<Skeleton className="h-[32rem] rounded-2xl" />}>
        <Protected area="admin" returnTo={ROUTES.admin}>
          {(viewer) => <AdminContent viewer={viewer} />}
        </Protected>
      </Suspense>
    </div>
  );
}

async function AdminContent({ viewer }: { viewer: Viewer }) {
  const from = new Date();
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + WINDOW_DAYS * 86_400_000);
  const data = await getAdminConsoleData(getDb(), viewer, { from, to });
  return <AdminConsole {...data} currentUserId={viewer.userId} windowDays={WINDOW_DAYS} />;
}
