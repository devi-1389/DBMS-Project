import { connection } from "next/server";

import { BookingPanel } from "@/components/booking/booking-panel";
import { isDatabaseConfigured } from "@/lib/auth/config";
import { getDb } from "@/lib/db";
import { listExperienceSessions } from "@/lib/dal/catalogue";
import { addDays, resortDayWindow, toDateKey } from "@/lib/format";
import type { ExperienceSlot, ExperienceSummary } from "@/lib/types/experience";

const LIVE_DAYS = 60;

/**
 * The experience page's planning and booking panel. With a database it shows live
 * sessions (seats, guides and shared equipment) read per request, so render it inside
 * <Suspense>. Without one, or if the database can't be reached, it shows the sample
 * sessions and doesn't offer booking.
 */
export async function LiveBookingPanel({
  experience,
  sampleSlots,
}: {
  experience: ExperienceSummary;
  sampleSlots: ExperienceSlot[];
}) {
  if (!isDatabaseConfigured()) return <BookingPanel experience={experience} slots={sampleSlots} mode="sample" />;

  await connection();
  const now = new Date();
  const today = toDateKey(now.toISOString());
  let sessions: ExperienceSlot[] | null = null;
  try {
    sessions = await listExperienceSessions(getDb(), experience.slug, resortDayWindow(today, addDays(today, LIVE_DAYS)));
  } catch (error) {
    console.error("[experience] live availability failed", error);
  }
  if (!sessions) {
    return (
      <BookingPanel
        experience={experience}
        slots={sampleSlots}
        mode="sample"
        notice="Live availability can't be loaded right now, so booking is paused."
      />
    );
  }
  return (
    <BookingPanel experience={experience} slots={sessions.filter((slot) => Date.parse(slot.startsAt) > now.getTime())} mode="live" />
  );
}
