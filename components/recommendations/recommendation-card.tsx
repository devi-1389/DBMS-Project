import Image from "next/image";
import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { CategoryBadge } from "@/components/experiences/category-badge";
import { PriceTag } from "@/components/experiences/price-tag";
import { AddToPlanButton } from "@/components/itinerary/add-to-plan-button";
import { formatDate, formatTimeRange } from "@/lib/format";
import type { Recommendation } from "@/lib/matching/recommend";
import { experienceHref } from "@/lib/navigation";

/** A recommendation with its full, explainable score breakdown. */
export function RecommendationCard({
  recommendation,
  rank,
  partySize,
  planId,
}: {
  recommendation: Recommendation;
  rank: number;
  partySize: number;
  planId?: string;
}) {
  const { experience, factors, percent, score, maxScore, sessions, fittingSessionCount } = recommendation;

  return (
    <article className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="grid gap-0 md:grid-cols-[14rem_1fr]">
        <div className="relative aspect-[16/9] bg-forest-900 md:aspect-auto">
          <Image src={experience.image.src} alt={experience.image.alt} fill sizes="(min-width: 768px) 224px, 100vw" className="object-cover" />
          <span className="absolute top-3 left-3 inline-flex size-8 items-center justify-center rounded-full bg-ivory-50/90 text-sm font-bold text-forest-900">
            {rank}
          </span>
        </div>
        <div className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <CategoryBadge category={experience.category} className="border-border" />
              <h2 className="mt-2 font-display text-2xl leading-tight font-semibold">
                <Link href={experienceHref(experience.slug)} className="hover:underline hover:underline-offset-4">
                  {experience.title}
                </Link>
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{experience.summary}</p>
            </div>
            <div className="text-right">
              <p className="font-display text-4xl leading-none font-semibold text-forest-700">{percent}%</p>
              <p className="mt-1 text-xs text-muted-foreground">
                match · {score} of {maxScore} points
              </p>
            </div>
          </div>

          <details className="group mt-4 rounded-xl border bg-ivory-100/60 px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold marker:text-gold-600">Why this score</summary>
            <dl className="mt-3 space-y-2.5">
              {factors.map((factor) => (
                <div key={factor.key} className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-3 text-sm">
                  <dt className="font-medium">{factor.label}</dt>
                  <dd className="min-w-0">
                    <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-forest-600"
                        style={{ width: `${factor.max ? (factor.points / factor.max) * 100 : 0}%` }}
                      />
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{factor.detail}</p>
                  </dd>
                  <dd className="text-xs font-semibold tabular-nums">
                    {factor.points}/{factor.max}
                  </dd>
                </div>
              ))}
            </dl>
          </details>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <PriceTag amountMinor={experience.priceFromMinor} currency={experience.currency} />
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="size-4 text-gold-600" aria-hidden="true" />
              {fittingSessionCount} session{fittingSessionCount === 1 ? "" : "s"} fit your filters
            </p>
          </div>

          <ul className="mt-4 divide-y rounded-xl border" aria-label={`Sessions for ${experience.title}`}>
            {sessions.slice(0, 3).map((slot) => {
              const left = slot.capacity - slot.booked;
              return (
                <li key={slot.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">{formatDate(slot.startsAt)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTimeRange(slot.startsAt, slot.endsAt)} · {left > 0 ? `${left} seats left` : "Full"}
                    </p>
                  </div>
                  <AddToPlanButton slotId={slot.id} partySize={partySize} planId={planId} />
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </article>
  );
}
