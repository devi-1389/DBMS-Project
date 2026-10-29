"use client";

import { CategoryIcon } from "@/components/experiences/category-icon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import {
  DURATION_OPTIONS,
  PRICE_OPTIONS,
  type CatalogueFilters,
  type DurationKey,
  type PriceKey,
} from "@/lib/catalogue-filters";
import { CATEGORY_LABELS, EXPERIENCE_CATEGORIES, type ExperienceCategory } from "@/lib/categories";
import { DIFFICULTIES, DIFFICULTY_LABELS, type Difficulty } from "@/lib/difficulty";
import { formatPrice } from "@/lib/format";

export type FilterFacets = {
  categories: Record<ExperienceCategory, number>;
  difficulties: Record<Difficulty, number>;
};

const toggle = <T,>(list: T[], value: T, on: boolean) =>
  on ? [...new Set([...list, value])] : list.filter((item) => item !== value);

function Section({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <div className="border-t pt-5 first:border-t-0 first:pt-0">
      <fieldset className="min-w-0">
        <legend className="eyebrow mb-4 text-gold-700">{legend}</legend>
        {children}
      </fieldset>
    </div>
  );
}

export function ExperienceFilters({
  idPrefix,
  filters,
  facets,
  dateRange,
  onChange,
  onReset,
}: {
  idPrefix: string;
  filters: CatalogueFilters;
  facets: FilterFacets;
  dateRange: { min: string; max: string };
  onChange: (patch: Partial<CatalogueFilters>) => void;
  onReset: () => void;
}) {
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="space-y-5">
      <Section legend="Category">
        <ul className="space-y-3">
          {EXPERIENCE_CATEGORIES.map((category) => (
            <li key={category} className="flex items-center gap-3">
              <Checkbox
                id={id(`category-${category}`)}
                checked={filters.categories.includes(category)}
                onCheckedChange={(checked) =>
                  onChange({ categories: toggle(filters.categories, category, checked === true) })
                }
              />
              <Label htmlFor={id(`category-${category}`)} className="flex-1 font-medium">
                <CategoryIcon category={category} className="size-4 text-gold-600" />
                {CATEGORY_LABELS[category]}
              </Label>
              <span className="text-xs text-muted-foreground tabular-nums">{facets.categories[category]}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section legend="Difficulty">
        <ul className="space-y-3">
          {DIFFICULTIES.map((difficulty) => (
            <li key={difficulty} className="flex items-center gap-3">
              <Checkbox
                id={id(`difficulty-${difficulty}`)}
                checked={filters.difficulties.includes(difficulty)}
                onCheckedChange={(checked) =>
                  onChange({ difficulties: toggle(filters.difficulties, difficulty, checked === true) })
                }
              />
              <Label htmlFor={id(`difficulty-${difficulty}`)} className="flex-1 font-medium">
                {DIFFICULTY_LABELS[difficulty]}
              </Label>
              <span className="text-xs text-muted-foreground tabular-nums">{facets.difficulties[difficulty]}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section legend="Duration">
        <RadioGroup
          value={filters.duration}
          onValueChange={(value) => onChange({ duration: value as DurationKey })}
          aria-label="Duration"
        >
          {DURATION_OPTIONS.map((option) => (
            <div key={option.value} className="flex items-center gap-3">
              <RadioGroupItem value={option.value} id={id(`duration-${option.value}`)} />
              <Label htmlFor={id(`duration-${option.value}`)} className="font-medium">
                {option.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </Section>

      <Section legend="Price per guest">
        <RadioGroup
          value={filters.price}
          onValueChange={(value) => onChange({ price: value as PriceKey })}
          aria-label="Price per guest"
        >
          {PRICE_OPTIONS.map((option) => (
            <div key={option.value} className="flex items-center gap-3">
              <RadioGroupItem value={option.value} id={id(`price-${option.value}`)} />
              <Label htmlFor={id(`price-${option.value}`)} className="font-medium">
                {option.value === "any" ? "Any price" : `Up to ${formatPrice(option.maxMinor)}`}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </Section>

      <Section legend="Availability">
        <div className="grid gap-2">
          <Label htmlFor={id("date")}>Available on</Label>
          <div className="flex gap-2">
            <Input
              id={id("date")}
              type="date"
              min={dateRange.min}
              max={dateRange.max}
              value={filters.date ?? ""}
              onChange={(event) => onChange({ date: event.target.value || null })}
            />
            {filters.date && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ date: null })}>
                Clear
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Sample season runs 2 to 15 November.</p>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <Label htmlFor={id("accessible")} className="font-medium">
            Step-free access only
          </Label>
          <Switch
            id={id("accessible")}
            checked={filters.accessible}
            onCheckedChange={(checked) => onChange({ accessible: checked })}
          />
        </div>
      </Section>

      <Button type="button" variant="outline" className="w-full" onClick={onReset}>
        Clear all filters
      </Button>
    </div>
  );
}
