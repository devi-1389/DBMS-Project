import Image from "next/image";
import Link from "next/link";

import { CategoryBadge } from "@/components/experiences/category-badge";
import { ExperienceMeta } from "@/components/experiences/experience-meta";
import { PriceTag } from "@/components/experiences/price-tag";
import { Skeleton } from "@/components/ui/skeleton";
import type { ExperienceSummary } from "@/lib/types/experience";
import { cn } from "@/lib/utils";

/**
 * With `href`, the whole card links to the experience (stretched title link) and
 * `action` sits above that link layer.
 */
export function ExperienceCard({
  experience,
  href,
  footnote,
  action,
  imageSizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
}: {
  experience: ExperienceSummary;
  href?: string;
  footnote?: React.ReactNode;
  action?: React.ReactNode;
  imageSizes?: string;
}) {
  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition duration-500 hover:-translate-y-1 hover:shadow-xl motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        href && "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-forest-900">
        <Image
          src={experience.image.src}
          alt={experience.image.alt}
          fill
          sizes={imageSizes}
          className="object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <CategoryBadge category={experience.category} className="absolute top-4 left-4" />
      </div>

      <div className="flex flex-1 flex-col p-6">
        <h3 className="font-display text-2xl leading-tight font-semibold">
          {href ? (
            <Link href={href} className="outline-none after:absolute after:inset-0 after:content-['']">
              {experience.title}
            </Link>
          ) : (
            experience.title
          )}
        </h3>
        <ExperienceMeta experience={experience} className="mt-3" />
        <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{experience.summary}</p>
        {footnote && <div className="mt-4 text-sm">{footnote}</div>}
        <div className="mt-auto flex items-end justify-between gap-4 pt-6">
          <PriceTag amountMinor={experience.priceFromMinor} currency={experience.currency} />
          {action && <div className="relative z-10">{action}</div>}
        </div>
      </div>
    </article>
  );
}

export function ExperienceCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="space-y-4 p-6">
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-12 w-full" />
        <div className="flex items-end justify-between pt-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function ExperienceGridSkeleton({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-6 sm:grid-cols-2 lg:grid-cols-3", className)} role="status" aria-label="Loading experiences">
      {Array.from({ length: count }, (_, i) => (
        <ExperienceCardSkeleton key={i} />
      ))}
    </div>
  );
}
