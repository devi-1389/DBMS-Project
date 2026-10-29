"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CalendarDays, Search, SearchX, SlidersHorizontal, X } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { ExperienceCard } from "@/components/experiences/experience-card";
import { ExperienceFilters, type FilterFacets } from "@/components/experiences/experience-filters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  applyFilters,
  countActiveFilters,
  DEFAULT_FILTERS,
  DURATION_OPTIONS,
  filtersToQuery,
  openSlotsBySlug,
  parseFilters,
  PRICE_OPTIONS,
  SORT_OPTIONS,
  type CatalogueFilters,
  type SortKey,
} from "@/lib/catalogue-filters";
import { CATEGORY_LABELS, EXPERIENCE_CATEGORIES } from "@/lib/categories";
import { DIFFICULTIES, DIFFICULTY_LABELS } from "@/lib/difficulty";
import { formatDate, formatDateKey, formatPrice, formatTime, toDateKey } from "@/lib/format";
import { experienceHref } from "@/lib/navigation";
import type { ExperienceSlot, ExperienceSummary } from "@/lib/types/experience";

type CatalogueProps = {
  experiences: ExperienceSummary[];
  slots: ExperienceSlot[];
  dateRange: { min: string; max: string };
};

/** Filters live in the URL so results can be shared. Must render inside <Suspense>. */
export function CatalogueExplorer(props: CatalogueProps) {
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);

  const setFilters = useCallback((next: CatalogueFilters) => {
    const query = filtersToQuery(next);
    // Native history updates sync with useSearchParams without a server round trip.
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, []);

  return <CatalogueView {...props} filters={filters} onFiltersChange={setFilters} />;
}

/** Static view, also the prerendered Suspense fallback (default filters). */
export function CatalogueView({
  experiences,
  slots,
  dateRange,
  filters,
  onFiltersChange,
}: CatalogueProps & {
  filters: CatalogueFilters;
  onFiltersChange?: (filters: CatalogueFilters) => void;
}) {
  const openSlots = useMemo(() => openSlotsBySlug(slots), [slots]);
  const results = useMemo(() => applyFilters(experiences, openSlots, filters), [experiences, openSlots, filters]);
  const facets = useMemo<FilterFacets>(() => {
    const withoutCategory = applyFilters(experiences, openSlots, { ...filters, categories: [] });
    const withoutDifficulty = applyFilters(experiences, openSlots, { ...filters, difficulties: [] });
    return {
      categories: Object.fromEntries(
        EXPERIENCE_CATEGORIES.map((c) => [c, withoutCategory.filter((e) => e.category === c).length]),
      ) as FilterFacets["categories"],
      difficulties: Object.fromEntries(
        DIFFICULTIES.map((d) => [d, withoutDifficulty.filter((e) => e.difficulty === d).length]),
      ) as FilterFacets["difficulties"],
    };
  }, [experiences, openSlots, filters]);

  const update = (patch: Partial<CatalogueFilters>) => onFiltersChange?.({ ...filters, ...patch });
  const reset = () => onFiltersChange?.({ ...DEFAULT_FILTERS, sort: filters.sort });
  const activeCount = countActiveFilters(filters);

  const filterPanel = (idPrefix: string) => (
    <ExperienceFilters
      idPrefix={idPrefix}
      filters={filters}
      facets={facets}
      dateRange={dateRange}
      onChange={update}
      onReset={reset}
    />
  );

  return (
    <div className="grid gap-10 lg:grid-cols-[17rem_1fr]">
      <aside aria-label="Filters" className="hidden lg:block">
        <div className="sticky top-28 rounded-2xl border bg-card p-6 shadow-sm">{filterPanel("desktop")}</div>
      </aside>

      <div className="min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              aria-label="Search experiences"
              placeholder="Search by name, place or interest"
              value={filters.q}
              onChange={(event) => update({ q: event.target.value })}
              className="h-11 pl-9"
            />
          </div>
          <div className="flex gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="h-11 flex-1 bg-card lg:hidden">
                  <SlidersHorizontal />
                  Filters
                  {activeCount > 0 && (
                    <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[0.7rem] text-primary-foreground">
                      {activeCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[88%] overflow-y-auto">
                <SheetHeader className="px-6 pt-6">
                  <SheetTitle className="font-display text-2xl">Filters</SheetTitle>
                  <SheetDescription>{results.length} experiences match.</SheetDescription>
                </SheetHeader>
                <div className="px-6 pb-8">{filterPanel("mobile")}</div>
              </SheetContent>
            </Sheet>
            <NativeSelect
              aria-label="Sort experiences"
              value={filters.sort}
              onChange={(event) => update({ sort: event.target.value as SortKey })}
              className="w-full sm:w-52 [&_select]:h-11"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>

        <ActiveFilters filters={filters} onChange={update} onReset={reset} />

        <p aria-live="polite" className="mt-5 text-sm text-muted-foreground">
          {results.length === 1 ? "1 experience" : `${results.length} experiences`}
          {filters.date ? ` with seats on ${formatDateKey(filters.date)}` : ""}
        </p>

        {results.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No experiences match"
            description="Try removing a filter or searching for something broader."
            className="mt-6"
          >
            <Button onClick={reset}>Clear filters</Button>
          </EmptyState>
        ) : (
          <ul className="mt-6 grid gap-6 md:grid-cols-2">
            {results.map((experience) => (
              <li key={experience.slug}>
                <ExperienceCard
                  experience={experience}
                  href={experienceHref(experience.slug)}
                  imageSizes="(min-width: 1024px) 30vw, (min-width: 768px) 50vw, 100vw"
                  footnote={
                    <Availability slots={openSlots.get(experience.slug) ?? []} date={filters.date} />
                  }
                  action={
                    <span
                      aria-hidden="true"
                      className="pointer-events-none inline-flex items-center gap-1.5 text-sm font-semibold text-forest-700"
                    >
                      View <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Availability({ slots, date }: { slots: ExperienceSlot[]; date: string | null }) {
  const relevant = date ? slots.filter((slot) => toDateKey(slot.startsAt) === date) : slots;
  const next = relevant[0];

  return (
    <p className="flex items-center gap-2 text-forest-700">
      <CalendarDays className="size-4 shrink-0 text-gold-600" aria-hidden="true" />
      {next ? (
        <span>
          {date ? `${relevant.length} session${relevant.length > 1 ? "s" : ""}, first at ` : "Next: "}
          {date ? formatTime(next.startsAt) : `${formatDate(next.startsAt)}, ${formatTime(next.startsAt)}`}
          <span className="text-muted-foreground"> · {next.capacity - next.booked} seats left</span>
        </span>
      ) : (
        <span className="text-muted-foreground">Fully booked in the sample season</span>
      )}
    </p>
  );
}

function ActiveFilters({
  filters,
  onChange,
  onReset,
}: {
  filters: CatalogueFilters;
  onChange: (patch: Partial<CatalogueFilters>) => void;
  onReset: () => void;
}) {
  const chips: { key: string; label: string; remove: () => void }[] = [
    ...filters.categories.map((category) => ({
      key: `c-${category}`,
      label: CATEGORY_LABELS[category],
      remove: () => onChange({ categories: filters.categories.filter((c) => c !== category) }),
    })),
    ...filters.difficulties.map((difficulty) => ({
      key: `d-${difficulty}`,
      label: DIFFICULTY_LABELS[difficulty],
      remove: () => onChange({ difficulties: filters.difficulties.filter((d) => d !== difficulty) }),
    })),
  ];
  if (filters.duration !== "any") {
    chips.push({
      key: "duration",
      label: DURATION_OPTIONS.find((o) => o.value === filters.duration)!.label,
      remove: () => onChange({ duration: "any" }),
    });
  }
  if (filters.price !== "any") {
    chips.push({
      key: "price",
      label: `Up to ${formatPrice(PRICE_OPTIONS.find((o) => o.value === filters.price)!.maxMinor)}`,
      remove: () => onChange({ price: "any" }),
    });
  }
  if (filters.date) chips.push({ key: "date", label: formatDateKey(filters.date), remove: () => onChange({ date: null }) });
  if (filters.accessible) chips.push({ key: "a11y", label: "Step-free", remove: () => onChange({ accessible: false }) });
  if (filters.q.trim()) chips.push({ key: "q", label: `“${filters.q.trim()}”`, remove: () => onChange({ q: "" }) });

  if (!chips.length) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.remove}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-forest-800/15 bg-secondary px-3 text-xs font-semibold text-secondary-foreground transition-colors hover:border-forest-800/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {chip.label}
          <X className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Remove filter</span>
        </button>
      ))}
      <Button type="button" variant="link" size="sm" onClick={onReset} className="h-8">
        Clear all
      </Button>
    </div>
  );
}
