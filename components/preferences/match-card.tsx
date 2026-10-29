import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";

import { CategoryBadge } from "@/components/experiences/category-badge";
import { PriceTag } from "@/components/experiences/price-tag";
import { Skeleton } from "@/components/ui/skeleton";
import type { Recommendation } from "@/lib/matching/recommend";
import { experienceHref } from "@/lib/navigation";

/** Compact recommendation with its match score and top reasons. */
export function MatchCard({ match, rank, action }: { match: Recommendation; rank: number; action?: React.ReactNode }) {
  const { experience, reasons, percent } = match;

  return (
    <article className="group relative flex gap-4 rounded-2xl border bg-card p-4 shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-ring hover:shadow-md">
      <div className="relative aspect-square w-24 shrink-0 self-start overflow-hidden rounded-xl bg-forest-900 sm:w-28">
        <Image src={experience.image.src} alt="" fill sizes="112px" className="object-cover" />
        <span className="absolute top-2 left-2 inline-flex size-6 items-center justify-center rounded-full bg-ivory-50/90 text-xs font-bold text-forest-900">
          {rank}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge category={experience.category} className="border-border" />
          <span className="text-xs font-semibold text-forest-700">{percent}% match</span>
        </div>
        <h3 className="mt-2 font-display text-xl leading-tight font-semibold">
          <Link
            href={experienceHref(experience.slug)}
            className="outline-none after:absolute after:inset-0 after:content-['']"
          >
            {experience.title}
          </Link>
        </h3>
        <ul className="mt-2 space-y-1">
          {reasons.slice(0, 3).map((reason) => (
            <li key={reason} className="flex items-start gap-2 text-xs text-muted-foreground">
              <Check className="mt-0.5 size-3.5 shrink-0 text-forest-600" aria-hidden="true" />
              {reason}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-end justify-between gap-3">
          <PriceTag amountMinor={experience.priceFromMinor} currency={experience.currency} className="[&>span:nth-child(2)]:text-xl" />
          {action && <div className="relative z-10">{action}</div>}
        </div>
      </div>
    </article>
  );
}

export function MatchListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4" role="status" aria-label="Loading matches">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex gap-4 rounded-2xl border bg-card p-4">
          <Skeleton className="size-24 rounded-xl sm:size-28" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
