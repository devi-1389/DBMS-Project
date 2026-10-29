"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarX2, Ticket } from "lucide-react";

import { BookingsTable } from "@/components/bookings/bookings-table";
import { EmptyState } from "@/components/common/empty-state";
import { PreviewNotice } from "@/components/common/preview-notice";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTES } from "@/lib/navigation";
import type { BookingStatus, BookingSummary } from "@/lib/types/booking";

const TABS: { value: string; label: string; statuses: BookingStatus[]; empty: string }[] = [
  { value: "upcoming", label: "Upcoming", statuses: ["confirmed", "pending"], empty: "No upcoming bookings." },
  { value: "past", label: "Past", statuses: ["completed", "no_show"], empty: "No past bookings." },
  { value: "cancelled", label: "Cancelled", statuses: ["cancelled"], empty: "No cancelled bookings." },
];

export function MyBookingsView({ sampleBookings }: { sampleBookings: BookingSummary[] }) {
  const [showSample, setShowSample] = useState(false);
  // Real bookings don't exist until the booking backend ships.
  const bookings = showSample ? sampleBookings : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Switch id="show-sample-bookings" checked={showSample} onCheckedChange={setShowSample} />
          <Label htmlFor="show-sample-bookings">Show sample bookings</Label>
        </div>
        <p className="text-sm text-muted-foreground">Preview the layout with invented bookings.</p>
      </div>

      {showSample && (
        <PreviewNotice title="Sample data">
          These bookings are invented for layout review. They aren&apos;t reservations and can&apos;t be changed.
        </PreviewNotice>
      )}

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
              {!showSample ? (
                <EmptyState
                  icon={Ticket}
                  title="You don't have any bookings yet"
                  description="Online booking isn't available in this preview, so nothing can be reserved. Plan sessions in your itinerary draft in the meantime."
                >
                  <Button asChild>
                    <Link href={ROUTES.experiences}>Browse experiences</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={ROUTES.itinerary}>Open itinerary draft</Link>
                  </Button>
                </EmptyState>
              ) : rows.length === 0 ? (
                <EmptyState icon={CalendarX2} title={tab.empty} />
              ) : (
                <BookingsTable
                  caption={`${tab.label} sample bookings`}
                  bookings={rows}
                  actions={(booking) =>
                    booking.status === "confirmed" || booking.status === "pending" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled
                        title="Cancellation isn't available in the preview"
                      >
                        Cancel (preview)
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">No actions</span>
                    )
                  }
                />
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
