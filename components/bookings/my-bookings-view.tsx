"use client";

import Link from "next/link";
import { ArrowRight, CalendarX2, Ticket } from "lucide-react";

import { BookingsTable } from "@/components/bookings/bookings-table";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { bookingHref, ROUTES } from "@/lib/navigation";
import type { BookingStatus, BookingSummary } from "@/lib/types/booking";

const TABS: { value: string; label: string; statuses: BookingStatus[]; empty: string }[] = [
  { value: "upcoming", label: "Upcoming", statuses: ["confirmed", "pending"], empty: "No upcoming bookings." },
  { value: "past", label: "Past", statuses: ["completed", "no_show"], empty: "No past bookings." },
  { value: "cancelled", label: "Cancelled", statuses: ["cancelled"], empty: "No cancelled bookings." },
];

/** The signed-in guest's own bookings (loaded server-side, scoped to them). */
export function MyBookingsView({ bookings }: { bookings: BookingSummary[] }) {
  if (bookings.length === 0) {
    return (
      <EmptyState
        icon={Ticket}
        title="You don't have any bookings yet"
        description="Book a session from any experience page or from your itinerary. Planned sessions aren't bookings and don't appear here."
      >
        <Button asChild>
          <Link href={ROUTES.recommendations}>See recommendations</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={ROUTES.itinerary}>Open your itinerary</Link>
        </Button>
      </EmptyState>
    );
  }

  return (
    <Tabs defaultValue="upcoming">
      <TabsList aria-label="Booking status">
        {TABS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
            <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">
              {bookings.filter((booking) => tab.statuses.includes(booking.status)).length}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>

      {TABS.map((tab) => {
        const rows = bookings.filter((booking) => tab.statuses.includes(booking.status));
        return (
          <TabsContent key={tab.value} value={tab.value}>
            {rows.length === 0 ? (
              <EmptyState icon={CalendarX2} title={tab.empty} />
            ) : (
              <BookingsTable
                caption={`${tab.label} bookings`}
                bookings={rows}
                detailHref={(booking) => bookingHref(booking.reference)}
                actions={(booking) => (
                  <Button asChild size="sm" variant="outline">
                    <Link href={bookingHref(booking.reference)}>
                      Details
                      <ArrowRight />
                      <span className="sr-only"> for booking {booking.reference}</span>
                    </Link>
                  </Button>
                )}
              />
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
