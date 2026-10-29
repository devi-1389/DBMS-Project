import Image from "next/image";
import Link from "next/link";
import { CalendarPlus, CircleCheck, Lightbulb, Route, Ticket, TriangleAlert, Users } from "lucide-react";

import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { AddToPlanButton } from "@/components/itinerary/add-to-plan-button";
import { CreatePlanDialog, EditPlanForm } from "@/components/itinerary/plan-form";
import { DeletePlanButton, PlanItemControls } from "@/components/itinerary/plan-item-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateKey, formatPrice, formatTimeRange, toDateKey } from "@/lib/format";
import { conflictMap, isOutsideStay, itineraryTotal, planDays } from "@/lib/itinerary";
import type { SuggestedSession } from "@/lib/matching/recommend";
import { bookingHref, experienceHref, experiencesOnDateHref, ROUTES } from "@/lib/navigation";
import type { BookingSummary } from "@/lib/types/booking";
import type { ItineraryPlan, ItineraryPlanSummary, PlannedItem } from "@/lib/types/guest";
import { cn } from "@/lib/utils";

export function ItineraryWorkspace({
  plans,
  plan,
  bookings,
  suggestions,
  partySize,
}: {
  plans: ItineraryPlanSummary[];
  plan: ItineraryPlan | null;
  bookings: BookingSummary[];
  suggestions: SuggestedSession[];
  partySize: number;
}) {
  if (!plan) {
    return (
      <EmptyState
        icon={Route}
        title="Start your first plan"
        description="Plans keep the sessions you're considering for a stay, saved to your account. Adding a session never books it."
      >
        <CreatePlanDialog hasPlans={false} />
        <Button asChild variant="outline">
          <Link href={ROUTES.recommendations}>See recommendations</Link>
        </Button>
      </EmptyState>
    );
  }

  const conflicts = conflictMap(plan.items);
  const days = planDays(plan, plan.items);
  const outside = plan.items.filter((item) => isOutsideStay(item.startsAt, plan.arrival, plan.departure));
  const inStay = plan.items.filter((item) => !outside.includes(item));
  const currency = plan.items[0]?.currency;

  return (
    <div className="space-y-8">
      <nav aria-label="Your plans" className="flex flex-wrap items-center gap-2">
        {plans.map((summary) => (
          <Link
            key={summary.id}
            href={`${ROUTES.itinerary}?plan=${summary.id}`}
            aria-current={summary.id === plan.id ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
              summary.id === plan.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary",
            )}
          >
            {summary.name}
            <span className="text-xs opacity-75 tabular-nums">{summary.itemCount}</span>
          </Link>
        ))}
        <CreatePlanDialog hasPlans />
      </nav>

      <section aria-labelledby="plan-settings-title" className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="plan-settings-title" className="font-display text-2xl font-semibold">
            {plan.name}
          </h2>
          <p className="text-sm text-muted-foreground">Saved to your account · not a reservation</p>
        </div>
        <div className="mt-5">
          <EditPlanForm plan={plan} />
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-[1fr_22rem] lg:gap-14">
        <div className="min-w-0 space-y-8">
          {plan.items.length === 0 ? (
            <EmptyState
              icon={CalendarPlus}
              title="No sessions planned yet"
              description="Add sessions from recommendations or any experience page."
            >
              <Button asChild>
                <Link href={`${ROUTES.recommendations}?plan=${plan.id}`}>See recommendations</Link>
              </Button>
            </EmptyState>
          ) : (
            <ol className="space-y-8" aria-label="Plan by day">
              {days.map((day, index) => {
                const items = inStay.filter((item) => toDateKey(item.startsAt) === day);
                return (
                  <li key={day}>
                    <section aria-labelledby={`day-${day}`}>
                      <div className="flex items-baseline justify-between gap-4 border-b pb-3">
                        <h3 id={`day-${day}`} className="font-display text-2xl font-semibold">
                          {formatDateKey(day, "long")}
                        </h3>
                        {plan.arrival && plan.departure && (
                          <span className="text-sm text-muted-foreground">
                            Day {index + 1} of {days.length}
                          </span>
                        )}
                      </div>
                      {items.length ? (
                        <ul className="mt-4 space-y-3">
                          {items.map((item) => (
                            <PlannedRow key={item.id} item={item} conflicts={conflicts.get(item.id)} />
                          ))}
                        </ul>
                      ) : (
                        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-dashed border-forest-800/20 px-5 py-6 text-sm sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-muted-foreground">Nothing planned. A free day is a fine thing too.</p>
                          <Button asChild variant="outline" size="sm">
                            <Link href={experiencesOnDateHref(day)}>
                              <CalendarPlus />
                              Find something for this day
                            </Link>
                          </Button>
                        </div>
                      )}
                    </section>
                  </li>
                );
              })}
            </ol>
          )}

          {outside.length > 0 && (
            <section aria-labelledby="outside-title" className="rounded-2xl border border-gold-500/50 bg-gold-200/30 p-6">
              <h3 id="outside-title" className="flex items-center gap-2 font-display text-2xl font-semibold">
                <TriangleAlert className="size-5 text-gold-700" aria-hidden="true" />
                Outside your stay
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">These sessions fall outside your arrival and departure dates.</p>
              <ul className="mt-4 space-y-3">
                {outside.map((item) => (
                  <PlannedRow key={item.id} item={item} conflicts={conflicts.get(item.id)} showDate />
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="suggestions-title" className="rounded-2xl border bg-ivory-200/50 p-6">
            <h3 id="suggestions-title" className="flex items-center gap-2 font-display text-2xl font-semibold">
              <Lightbulb className="size-5 text-gold-600" aria-hidden="true" />
              Suggested for this stay
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Ranked from your preferences, avoiding clashes with your plan. Not in your plan until you add them.
            </p>
            {suggestions.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                {plan.arrival && plan.departure
                  ? "No further sessions fit your stay and preferences."
                  : "Add arrival and departure dates to get suggestions for your stay."}
              </p>
            ) : (
              <ul className="mt-4 divide-y rounded-xl border bg-card">
                {suggestions.map(({ recommendation, slot }) => (
                  <li key={slot.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <Link
                        href={experienceHref(recommendation.experience.slug)}
                        className="font-semibold hover:underline hover:underline-offset-4"
                      >
                        {recommendation.experience.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(slot.startsAt)} · {formatTimeRange(slot.startsAt, slot.endsAt)} · {recommendation.percent}% match
                      </p>
                      <p className="text-xs text-muted-foreground">{recommendation.reasons[0]}</p>
                    </div>
                    <AddToPlanButton slotId={slot.id} partySize={partySize} planId={plan.id} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
          <section aria-labelledby="summary-title" className="rounded-3xl border bg-card p-6 shadow-lg">
            <h3 id="summary-title" className="font-display text-2xl font-semibold">
              Plan summary
            </h3>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Planned sessions</dt>
                <dd className="font-semibold">{plan.items.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Overlaps</dt>
                <dd className="font-semibold">{conflicts.size ? `${conflicts.size} sessions` : "None"}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t pt-4">
                <dt className="font-semibold">Estimated total</dt>
                <dd className="font-display text-3xl font-semibold">{formatPrice(itineraryTotal(plan.items), currency)}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">
              Estimates only. Planned sessions aren&apos;t reserved and don&apos;t hold seats.
            </p>
            <div className="mt-4">
              <DeletePlanButton planId={plan.id} name={plan.name} />
            </div>
          </section>

          <section aria-labelledby="bookings-title" className="rounded-3xl border bg-card p-6 shadow-sm">
            <h3 id="bookings-title" className="flex items-center gap-2 font-display text-2xl font-semibold">
              <Ticket className="size-5 text-gold-600" aria-hidden="true" />
              Confirmed bookings
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {plan.arrival && plan.departure ? "During this stay." : "Upcoming."} Kept separate from your plan.
            </p>
            {bookings.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No bookings yet.</p>
            ) : (
              <ul className="mt-4 divide-y">
                {bookings.map((booking) => (
                  <li key={booking.reference} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <Link href={bookingHref(booking.reference)} className="block truncate font-semibold hover:underline">
                        {booking.experienceTitle}
                      </Link>
                      <p className="text-xs text-muted-foreground">{formatDate(booking.startsAt)}</p>
                    </div>
                    <BookingStatusBadge status={booking.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function PlannedRow({ item, conflicts, showDate }: { item: PlannedItem; conflicts?: string[]; showDate?: boolean }) {
  return (
    <li className="flex flex-wrap gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:flex-nowrap">
      <div className="relative hidden aspect-square w-20 shrink-0 self-start overflow-hidden rounded-xl bg-forest-900 sm:block">
        {item.imageSrc && <Image src={item.imageSrc} alt="" fill sizes="80px" className="object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gold-700">
          {showDate && `${formatDate(item.startsAt)} · `}
          {formatTimeRange(item.startsAt, item.endsAt)}
        </p>
        <h4 className="mt-1 font-display text-xl leading-tight font-semibold">
          <Link href={experienceHref(item.experienceSlug)} className="hover:underline hover:underline-offset-4">
            {item.title}
          </Link>
        </h4>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-4" aria-hidden="true" />
            {item.partySize} guest{item.partySize > 1 ? "s" : ""}
          </span>
          <span aria-hidden="true">·</span>
          <span>{formatPrice(item.unitPriceMinor * item.partySize, item.currency)} est.</span>
          {item.booking ? (
            <Badge variant="secondary" className="gap-1">
              <CircleCheck className="size-3.5" aria-hidden="true" />
              Booked · {item.booking.reference}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-gold-500/50 bg-gold-200/50 text-gold-700">
              Planned, not booked
            </Badge>
          )}
        </div>
        {item.slotStatus !== "scheduled" && (
          <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-destructive">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            This session was {item.slotStatus === "cancelled" ? "cancelled" : "completed"}.
          </p>
        )}
        {conflicts && (
          <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-gold-700">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            Overlaps with {conflicts.join(", ")}
          </p>
        )}
      </div>
      {!item.booking && item.slotStatus === "scheduled" && (
        <PlanItemControls itemId={item.id} title={item.title} partySize={item.partySize} maxParty={item.seatsLeft} />
      )}
    </li>
  );
}
