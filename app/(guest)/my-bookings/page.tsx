import type { Metadata } from "next";
import { Suspense } from "react";

import { Protected } from "@/components/auth/protected";
import { MyBookingsView } from "@/components/bookings/my-bookings-view";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getDb } from "@/lib/db";
import { listGuestBookings } from "@/lib/dal/bookings";
import { ROUTES } from "@/lib/navigation";

export const metadata: Metadata = { title: "My bookings" };

export default function MyBookingsPage() {
  return (
    <>
      <PageHeader
        size="compact"
        eyebrow="Reservations"
        title="My bookings"
        description="Your confirmed, pending and past reservations. Planned sessions live in your itinerary."
      />
      <Suspense fallback={<Skeleton className="h-72 rounded-2xl" />}>
        <Protected area="guest" returnTo={ROUTES.myBookings}>
          {async (viewer) => <MyBookingsView bookings={await listGuestBookings(getDb(), viewer.userId)} />}
        </Protected>
      </Suspense>
    </>
  );
}
