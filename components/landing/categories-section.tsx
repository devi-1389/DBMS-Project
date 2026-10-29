import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { CategoryIcon } from "@/components/experiences/category-icon";
import { SectionHeading } from "@/components/landing/section-heading";
import { CATEGORY_LABELS } from "@/lib/categories";
import { categoryHref, SECTION_IDS } from "@/lib/navigation";
import type { CategoryHighlight } from "@/lib/types/experience";

export function CategoriesSection({ categories }: { categories: CategoryHighlight[] }) {
  return (
    <section
      id={SECTION_IDS.categories}
      aria-labelledby="categories-title"
      className="scroll-mt-20 py-24 sm:py-32"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <SectionHeading
          id="categories-title"
          eyebrow="Six ways to stay"
          title="Choose how you want to feel"
          description="Every experience belongs to one of six categories. Start with a feeling and we will show you where it leads."
        />
        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((item) => (
            <li key={item.category} className="reveal">
              <CategoryCard item={item} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function CategoryCard({ item }: { item: CategoryHighlight }) {
  const label = CATEGORY_LABELS[item.category];

  return (
    <Link
      href={categoryHref(item.category)}
      className="group relative isolate flex aspect-[5/4] flex-col overflow-hidden rounded-2xl bg-forest-900 p-6 text-ivory-50 shadow-sm transition duration-500 hover:-translate-y-1 hover:shadow-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:aspect-[4/5] sm:p-7"
    >
      <Image
        src={item.image.src}
        alt={item.image.alt}
        fill
        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        className="-z-20 object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-forest-950/95 via-forest-950/40 to-forest-950/10"
      />
      <span className="inline-flex size-12 items-center justify-center rounded-full border border-ivory-50/30 bg-forest-950/30 text-gold-300 backdrop-blur-sm">
        <CategoryIcon category={item.category} className="size-5" />
      </span>
      <div className="mt-auto">
        <p className="eyebrow text-gold-300">{item.tagline}</p>
        <h3 className="mt-2 font-display text-3xl font-medium sm:text-4xl">{label}</h3>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-ivory-100/80">{item.description}</p>
        <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold">
          View {label.toLowerCase()} experiences
          <ArrowRight
            className="size-4 transition-transform duration-500 group-hover:translate-x-1"
            aria-hidden="true"
          />
        </span>
      </div>
    </Link>
  );
}
