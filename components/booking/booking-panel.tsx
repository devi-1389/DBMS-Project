"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { CalendarPlus, Lock } from "lucide-react";

import { addSessionToPlanAction } from "@/app/actions/itinerary";
import { QuantityInput } from "@/components/common/quantity-input";
import { Button } from "@/components/ui/button";
import { formatDate, formatPrice, formatTimeRange, toDateKey } from "@/lib/format";
import { experienceHref, ROUTES } from "@/lib/navigation";
import type { ExperienceSlot, ExperienceSummary } from "@/lib/types/experience";
import { cn } from "@/lib/utils";

const seatsLeft = (slot: ExperienceSlot) => slot.capacity - slot.booked;

type Feedback = { ok: boolean; message?: string; code?: string };

export function BookingPanel({ experience, slots }: { experience: ExperienceSummary; slots: ExperienceSlot[] }) {
  const days = useMemo(() => {
    const map = new Map<string, ExperienceSlot[]>();
    for (const slot of slots) {
      const key = toDateKey(slot.startsAt);
      map.set(key, [...(map.get(key) ?? []), slot]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  const firstOpenDay = days.find(([, daySlots]) => daySlots.some((slot) => seatsLeft(slot) > 0))?.[0] ?? null;
  const [dayKey, setDayKey] = useState(firstOpenDay);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [partySize, setPartySize] = useState(2);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pending, startTransition] = useTransition();

  const daySlots = days.find(([key]) => key === dayKey)?.[1] ?? [];
  // Default to the first open session of the chosen day.
  const slot =
    daySlots.find((candidate) => candidate.id === slotId && seatsLeft(candidate) > 0) ??
    daySlots.find((candidate) => seatsLeft(candidate) > 0) ??
    null;
  const maxParty = slot ? Math.min(seatsLeft(slot), experience.maxGroupSize) : 1;
  const guests = Math.min(partySize, maxParty);
  const total = experience.priceFromMinor * guests;

  // The server resolves the session by experience and start time, re-checks it and
  // the guest's ownership of the plan; nothing here is trusted beyond the request.
  const addToPlan = () => {
    if (!slot) return;
    startTransition(async () => {
      setFeedback(
        await addSessionToPlanAction({ experienceSlug: experience.slug, startsAt: slot.startsAt, partySize: guests }),
      );
    });
  };

  if (days.length === 0) {
    return (
      <PanelShell>
        <p className="text-sm text-muted-foreground">No sessions are scheduled in the sample season.</p>
      </PanelShell>
    );
  }

  return (
    <PanelShell>
      <fieldset className="min-w-0">
        <legend className="text-sm font-semibold">Choose a date</legend>
        <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
          {days.map(([key, list]) => {
            const full = list.every((candidate) => seatsLeft(candidate) <= 0);
            const selected = key === dayKey;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={selected}
                disabled={full}
                onClick={() => {
                  setDayKey(key);
                  setSlotId(null);
                  setFeedback(null);
                }}
                className={cn(
                  "flex w-16 shrink-0 flex-col items-center rounded-xl border px-2 py-2 text-center transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-45",
                  selected ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary",
                )}
              >
                <span className="text-[0.65rem] font-semibold tracking-wider uppercase">
                  {formatDate(list[0].startsAt).split(" ")[0]}
                </span>
                <span className="font-display text-2xl leading-tight font-semibold">{Number(key.slice(8))}</span>
                <span className="text-[0.65rem]">{full ? "Full" : formatDate(list[0].startsAt).split(" ")[2]}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-6 min-w-0">
        <legend className="text-sm font-semibold">Choose a time</legend>
        <div className="mt-3 grid gap-2">
          {daySlots.map((candidate) => {
            const left = seatsLeft(candidate);
            const selected = candidate.id === slot?.id;
            return (
              <button
                key={candidate.id}
                type="button"
                aria-pressed={selected}
                disabled={left <= 0}
                onClick={() => {
                  setSlotId(candidate.id);
                  setFeedback(null);
                }}
                className={cn(
                  "flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
                  selected ? "border-primary bg-secondary" : "bg-card hover:bg-secondary/60",
                )}
              >
                <span className="font-semibold">{formatTimeRange(candidate.startsAt, candidate.endsAt)}</span>
                <span className={cn("text-xs", left > 0 && left <= 3 ? "font-semibold text-gold-700" : "text-muted-foreground")}>
                  {left <= 0 ? "Full" : `${left} seat${left > 1 ? "s" : ""} left`}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <QuantityInput
        className="mt-6 border-t pt-6"
        label="Guests"
        description={`Up to ${maxParty} for this session`}
        value={guests}
        min={1}
        max={maxParty}
        onChange={(value) => {
          setPartySize(value);
          setFeedback(null);
        }}
      />

      <dl className="mt-6 space-y-2 border-t pt-6 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">
            {formatPrice(experience.priceFromMinor, experience.currency)}
            {experience.priceFromMinor > 0 && ` × ${guests} guest${guests > 1 ? "s" : ""}`}
          </dt>
          <dd className="font-semibold">{formatPrice(total, experience.currency)}</dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt className="font-semibold">Estimated total</dt>
          <dd className="font-display text-3xl font-semibold">{formatPrice(total, experience.currency)}</dd>
        </div>
      </dl>

      <div className="mt-6 grid gap-3">
        <Button size="lg" variant="outline" onClick={addToPlan} disabled={!slot || pending}>
          <CalendarPlus />
          {pending ? "Adding…" : "Add to my plan"}
        </Button>
        <Button size="lg" disabled aria-describedby="booking-unavailable">
          <Lock />
          Online booking coming soon
        </Button>
        <p id="booking-unavailable" className="text-center text-xs text-muted-foreground">
          Plans are saved to your account but don&apos;t reserve seats. Nothing is charged.
        </p>
      </div>

      <div aria-live="polite" className="mt-3 text-center text-sm">
        {feedback?.ok && (
          <p className="font-semibold text-forest-700">
            {feedback.message ?? "Added to your plan."}{" "}
            <Link href={ROUTES.itinerary} className="underline underline-offset-4">
              View itinerary
            </Link>
          </p>
        )}
        {feedback && !feedback.ok && (
          <p role="alert" className="text-destructive">
            {feedback.message}
            {feedback.code === "unauthenticated" && (
              <>
                {" "}
                <Link
                  href={`${ROUTES.login}?redirect_url=${encodeURIComponent(experienceHref(experience.slug))}`}
                  className="font-semibold underline underline-offset-4"
                >
                  Sign in
                </Link>
              </>
            )}
          </p>
        )}
      </div>
    </PanelShell>
  );
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <section aria-labelledby="booking-panel-title" className="rounded-3xl border bg-card p-6 shadow-lg sm:p-7">
      <h2 id="booking-panel-title" className="font-display text-2xl font-semibold">
        Plan this experience
      </h2>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">Sample season, 2 to 15 November. Resort time.</p>
      {children}
    </section>
  );
}
