"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Info } from "lucide-react";

import { CategoryBadge } from "@/components/experiences/category-badge";
import { ExperienceMeta } from "@/components/experiences/experience-meta";
import { PriceTag } from "@/components/experiences/price-tag";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CATEGORY_LABELS, type ExperienceCategory } from "@/lib/categories";
import { experienceHref } from "@/lib/navigation";
import type { ExperienceSummary } from "@/lib/types/experience";

export function ExperienceDetailsDialog({
  experience,
  activeCategory,
  onShowCategory,
}: {
  experience: ExperienceSummary;
  activeCategory: ExperienceCategory | null;
  onShowCategory?: (category: ExperienceCategory) => void;
}) {
  const label = CATEGORY_LABELS[experience.category];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          View details
          <span className="sr-only"> for {experience.title}</span>
          <ArrowRight />
        </Button>
      </DialogTrigger>
      {/* Block flow so the image keeps its height when content scrolls inside the height cap. */}
      <DialogContent className="block max-h-[90svh] overflow-y-auto p-0 sm:max-w-2xl">
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-2xl bg-forest-900">
          <Image
            src={experience.image.src}
            alt={experience.image.alt}
            fill
            sizes="(min-width: 640px) 672px, 100vw"
            className="object-cover"
          />
          <CategoryBadge category={experience.category} className="absolute bottom-4 left-4" />
        </div>

        <div className="space-y-6 p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl leading-tight font-semibold sm:text-4xl">
              {experience.title}
            </DialogTitle>
            <DialogDescription className="text-base">{experience.summary}</DialogDescription>
          </DialogHeader>

          <ExperienceMeta experience={experience} />

          <p className="leading-relaxed">{experience.description}</p>

          <div>
            <h3 className="eyebrow text-gold-700">Highlights</h3>
            <ul className="mt-3 space-y-2">
              {experience.highlights.map((highlight) => (
                <li key={highlight} className="flex items-start gap-3">
                  <Check className="mt-0.5 size-4 shrink-0 text-forest-600" aria-hidden="true" />
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-muted-foreground">Minimum age {experience.minAge}.</p>
          </div>

          <div className="flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-end sm:justify-between">
            <PriceTag amountMinor={experience.priceFromMinor} currency={experience.currency} />
            <div className="flex flex-col gap-2 sm:flex-row">
              {activeCategory !== experience.category && onShowCategory && (
                <DialogClose asChild>
                  <Button variant="outline" onClick={() => onShowCategory(experience.category)}>
                    More {label} experiences
                  </Button>
                </DialogClose>
              )}
              <Button asChild>
                <Link href={experienceHref(experience.slug)}>
                  Dates and availability
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>

          <p className="flex items-start gap-2 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Online booking opens with guest accounts. Details shown are a preview.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
