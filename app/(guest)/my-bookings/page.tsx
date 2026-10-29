import type { Metadata } from "next";

import { MyBookingsView } from "@/components/bookings/my-bookings-view";
import { PageHeader } from "@/components/layout/page-header";
// PLACEHOLDER: sample bookings for layout review only.
import { listSampleGuestBookings } from "@/lib/placeholder/catalogue";

export const metadata: Metadata = { title: "My bookings" };

export default async function MyBookingsPage() {
  const sampleBookings = await listSampleGuestBookings();

  return (
    <>
      <PageHeader
        size="compact"
        eyebrow="Reservations"
        title="My bookings"
        description="Confirmed, upcoming and past reservations will appear here once online booking is live."
      />
      <MyBookingsView sampleBookings={sampleBookings} />
    </>
  );
}
