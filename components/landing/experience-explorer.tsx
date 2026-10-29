"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";

import { CategoryIcon } from "@/components/experiences/category-icon";
import { ExperienceCard } from "@/components/experiences/experience-card";
import { ExperienceDetailsDialog } from "@/components/experiences/experience-details-dialog";
import { Button } from "@/components/ui/button";
import {
  CATEGORY_LABELS,
  EXPERIENCE_CATEGORIES,
  isExperienceCategory,
  type ExperienceCategory,
} from "@/lib/categories";
import { SECTION_IDS } from "@/lib/navigation";
import type { ExperienceSummary } from "@/lib/types/experience";

/** Reads the `?category=` filter from the URL. Must render inside <Suspense>. */
export function ExperienceExplorer({ experiences }: { experiences: ExperienceSummary[] }) {
  const searchParams = useSearchParams();
  const raw = searchParams.get("category");
  const category = isExperienceCategory(raw) ? raw : null;

  const selectCategory = useCallback((next: ExperienceCategory | null) => {
    const params = new URLSearchParams(window.location.search);
    if (next) params.set("category", next);
    else params.delete("category");
    const query = params.toString();
    // Native history updates sync with useSearchParams without a server round trip.
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}#${SECTION_IDS.experiences}`,
    );
  }, []);

  return (
    <ExperienceExplorerView
      experiences={experiences}
      category={category}
      onSelectCategory={selectCategory}
    />
  );
}

/** Static view, also used as the prerendered Suspense fallback. */
export function ExperienceExplorerView({
  experiences,
  category,
  onSelectCategory,
}: {
  experiences: ExperienceSummary[];
  category: ExperienceCategory | null;
  onSelectCategory?: (category: ExperienceCategory | null) => void;
}) {
  const visible = category
    ? experiences.filter((experience) => experience.category === category)
    : experiences.filter((experience) => experience.featured);

  return (
    <div className="mt-12">
      <div
        role="group"
        aria-label="Filter experiences by category"
        className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-2 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
      >
        <FilterButton active={category === null} onClick={() => onSelectCategory?.(null)}>
          All featured
        </FilterButton>
        {EXPERIENCE_CATEGORIES.map((item) => (
          <FilterButton key={item} active={category === item} onClick={() => onSelectCategory?.(item)}>
            <CategoryIcon category={item} />
            {CATEGORY_LABELS[item]}
          </FilterButton>
        ))}
      </div>

      <p aria-live="polite" className="mt-6 text-sm text-muted-foreground">
        {category
          ? `Showing ${visible.length} ${CATEGORY_LABELS[category]} experiences`
          : `Showing ${visible.length} featured experiences, one from each category`}
      </p>

      <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((experience, index) => (
          <li
            key={experience.slug}
            className="motion-safe:animate-fade-up"
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <ExperienceCard
              experience={experience}
              action={
                <ExperienceDetailsDialog
                  experience={experience}
                  activeCategory={category}
                  onShowCategory={onSelectCategory}
                />
              }
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      aria-pressed={active}
      onClick={onClick}
      className={active ? undefined : "bg-card"}
    >
      {children}
    </Button>
  );
}
