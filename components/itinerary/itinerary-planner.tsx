"use client";

import Image from "next/image";
import Link from "next/link";
import { CalendarPlus, Lock, Route, Trash, TriangleAlert, Users } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { PreviewBadge } from "@/components/common/preview-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { daysBetween, formatDateKey, formatPrice, formatTimeRange, toDateKey } from "@/lib/format";
import { conflictMap, itineraryTotal, planDays, removeItem, validateStay } from "@/lib/itinerary";
import { experienceHref, experiencesOnDateHref, ROUTES } from "@/lib/navigation";
import { itineraryStore, usePreviewStore } from "@/lib/preview-store";
import type { ExperienceSummary } from "@/lib/types/experience";
import type { ItineraryDraft, ItineraryItem } from "@/lib/types/guest";

type Season = { start: string; end: string };

export function ItineraryPlanner({ experiences, season }: { experiences: ExperienceSummary[]; season: Season }) {
  const [draft, setDraft] = usePreviewStore(itineraryStore);

  if (draft === undefined) return <ItinerarySkeleton />;

  const stayErrors = validateStay(draft.arrival, draft.departure, season);
  const stayValid = Boolean(draft.arrival && draft.departure) && Object.keys(stayErrors).length === 0;
  const days = planDays(draft, stayValid);
  const conflicts = conflictMap(draft.items);
  const outside = stayValid
    ? draft.items.filter((item) => {
        const key = toDateKey(item.startsAt);
        return key < draft.arrival! || key > draft.departure!;
      })
    : [];
  const images = new Map(experiences.map((experience) => [experience.slug, experience.image.src]));
  const remove = (slotId: string) => setDraft(removeItem(draft, slotId));

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem] lg:gap-14">
      <div className="min-w-0 space-y-8">
        <StayDates draft={draft} season={season} errors={stayErrors} onChange={setDraft} />

        {draft.items.length === 0 ? (
          <EmptyState
            icon={Route}
            title="Your itinerary is empty"
            description="Add sessions from any experience page to plan your days. Plans stay in this browser and aren't reservations."
          >
            <Button asChild>
              <Link href={ROUTES.experiences}>Browse experiences</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={ROUTES.preferences}>See your matches</Link>
            </Button>
          </EmptyState>
        ) : (
          <ol className="space-y-8" aria-label="Itinerary by day">
            {days.map((day, index) => {
              const items = draft.items.filter((item) => toDateKey(item.startsAt) === day);
              const inSeason = day >= season.start && day <= season.end;
              return (
                <li key={day}>
                  <section aria-labelledby={`day-${day}`}>
                    <div className="flex items-baseline justify-between gap-4 border-b pb-3">
                      <h2 id={`day-${day}`} className="font-display text-2xl font-semibold">
                        {formatDateKey(day, "long")}
                      </h2>
                      {stayValid && (
                        <span className="text-sm text-muted-foreground">
                          Day {index + 1} of {days.length}
                        </span>
                      )}
                    </div>
                    {items.length ? (
                      <ul className="mt-4 space-y-3">
                        {items.map((item) => (
                          <ItineraryRow
                            key={item.slotId}
                            item={item}
                            image={images.get(item.experienceSlug)}
                            conflicts={conflicts.get(item.slotId)}
                            onRemove={() => remove(item.slotId)}
                          />
                        ))}
                      </ul>
                    ) : (
                      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-dashed border-forest-800/20 px-5 py-6 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-muted-foreground">Nothing planned. A free day is a fine thing too.</p>
                        {inSeason && (
                          <Button asChild variant="outline" size="sm">
                            <Link href={experiencesOnDateHref(day)}>
                              <CalendarPlus />
                              Find something for this day
                            </Link>
                          </Button>
                        )}
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
            <h2 id="outside-title" className="flex items-center gap-2 font-display text-2xl font-semibold">
              <TriangleAlert className="size-5 text-gold-700" aria-hidden="true" />
              Outside your stay
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">These sessions fall outside your arrival and departure dates.</p>
            <ul className="mt-4 space-y-3">
              {outside.map((item) => (
                <ItineraryRow
                  key={item.slotId}
                  item={item}
                  image={images.get(item.experienceSlug)}
                  showDate
                  onRemove={() => remove(item.slotId)}
                />
              ))}
            </ul>
          </section>
        )}
      </div>

      <aside className="lg:sticky lg:top-28 lg:self-start">
        <PlanSummary draft={draft} conflicts={conflicts.size} stayValid={stayValid} onClear={() => setDraft({ ...draft, items: [] })} />
      </aside>
    </div>
  );
}

function StayDates({
  draft,
  season,
  errors,
  onChange,
}: {
  draft: ItineraryDraft;
  season: Season;
  errors: ReturnType<typeof validateStay>;
  onChange: (draft: ItineraryDraft) => void;
}) {
  const nights =
    draft.arrival && draft.departure && !errors.arrival && !errors.departure
      ? daysBetween(draft.arrival, draft.departure)
      : null;

  return (
    <section aria-labelledby="stay-title" className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="stay-title" className="font-display text-2xl font-semibold">
          Your stay
        </h2>
        <p className="text-sm text-muted-foreground">
          {nights !== null ? `${nights} night${nights === 1 ? "" : "s"}` : "Add dates to see every day"}
        </p>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {(["arrival", "departure"] as const).map((field) => (
          <div key={field} className="grid gap-2">
            <Label htmlFor={`stay-${field}`}>{field === "arrival" ? "Arrival" : "Departure"}</Label>
            <Input
              id={`stay-${field}`}
              type="date"
              min={field === "departure" && draft.arrival ? draft.arrival : season.start}
              max={season.end}
              value={draft[field] ?? ""}
              onChange={(event) => onChange({ ...draft, [field]: event.target.value || null })}
              aria-invalid={Boolean(errors[field])}
              aria-describedby={errors[field] ? `stay-${field}-error` : undefined}
            />
            {errors[field] && (
              <p id={`stay-${field}-error`} className="text-xs font-medium text-destructive">
                {errors[field]}
              </p>
            )}
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Sample season: {formatDateKey(season.start)} to {formatDateKey(season.end)}. Changes save automatically in this
        browser.
      </p>
    </section>
  );
}

function ItineraryRow({
  item,
  image,
  conflicts,
  showDate,
  onRemove,
}: {
  item: ItineraryItem;
  image?: string;
  conflicts?: string[];
  showDate?: boolean;
  onRemove: () => void;
}) {
  return (
    <li className="flex gap-4 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="relative hidden aspect-square w-20 shrink-0 overflow-hidden rounded-xl bg-forest-900 sm:block">
        {image && <Image src={image} alt="" fill sizes="80px" className="object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gold-700">
          {showDate && `${formatDateKey(toDateKey(item.startsAt))} · `}
          {formatTimeRange(item.startsAt, item.endsAt)}
        </p>
        <h3 className="mt-1 font-display text-xl leading-tight font-semibold">
          <Link href={experienceHref(item.experienceSlug)} className="hover:underline hover:underline-offset-4">
            {item.title}
          </Link>
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-4" aria-hidden="true" />
            {item.partySize} guest{item.partySize > 1 ? "s" : ""}
          </span>
          <span aria-hidden="true">·</span>
          <span>{formatPrice(item.unitPriceMinor * item.partySize, item.currency)} est.</span>
          <PreviewBadge className="ml-1">Not reserved</PreviewBadge>
        </div>
        {conflicts && (
          <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-gold-700">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            Overlaps with {conflicts.join(", ")}
          </p>
        )}
      </div>
      <Button variant="ghost" size="icon-sm" onClick={onRemove} className="shrink-0 self-start">
        <Trash />
        <span className="sr-only">Remove {item.title} from itinerary</span>
      </Button>
    </li>
  );
}

function PlanSummary({
  draft,
  conflicts,
  stayValid,
  onClear,
}: {
  draft: ItineraryDraft;
  conflicts: number;
  stayValid: boolean;
  onClear: () => void;
}) {
  const total = itineraryTotal(draft.items);
  const currency = draft.items[0]?.currency;

  return (
    <section aria-labelledby="summary-title" className="rounded-3xl border bg-card p-6 shadow-lg">
      <h2 id="summary-title" className="font-display text-2xl font-semibold">
        Plan summary
      </h2>
      <dl className="mt-5 space-y-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Planned sessions</dt>
          <dd className="font-semibold">{draft.items.length}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Stay dates</dt>
          <dd className="font-semibold">{stayValid ? "Set" : "Not set"}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Overlaps</dt>
          <dd>
            {conflicts ? (
              <Badge variant="outline" className="border-gold-500/60 text-gold-700">
                {conflicts} session{conflicts > 1 ? "s" : ""}
              </Badge>
            ) : (
              <span className="font-semibold">None</span>
            )}
          </dd>
        </div>
        <div className="flex items-baseline justify-between border-t pt-4">
          <dt className="font-semibold">Estimated total</dt>
          <dd className="font-display text-3xl font-semibold">{formatPrice(total, currency)}</dd>
        </div>
      </dl>
      <div className="mt-6 grid gap-3">
        <Button size="lg" disabled aria-describedby="request-unavailable">
          <Lock />
          Request bookings
        </Button>
        <p id="request-unavailable" className="text-center text-xs text-muted-foreground">
          Booking requests open with guest accounts. Nothing here is reserved.
        </p>
        {draft.items.length > 0 && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                Clear itinerary
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">Clear your itinerary?</DialogTitle>
                <DialogDescription>
                  This removes all {draft.items.length} planned sessions from this browser. Your stay dates stay.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Keep plans</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="destructive" onClick={onClear}>
                    Clear itinerary
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </section>
  );
}

function ItinerarySkeleton() {
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem] lg:gap-14" role="status" aria-label="Loading itinerary">
      <div className="space-y-6">
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
      <Skeleton className="h-80 rounded-3xl" />
    </div>
  );
}
