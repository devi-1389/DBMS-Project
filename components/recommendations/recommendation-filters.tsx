import Form from "next/form";
import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { formatPrice } from "@/lib/format";
import type { RecommendationFilters } from "@/lib/matching/recommend";
import { ROUTES } from "@/lib/navigation";
import { BUDGET_OPTIONS, TIMES_OF_DAY } from "@/lib/preferences";
import type { ItineraryPlanSummary } from "@/lib/types/guest";
import { MAX_PARTY_SIZE } from "@/lib/validation/schemas";

/** GET form: filters live in the URL, so results are shareable and work without JS. */
export function RecommendationFiltersForm({
  filters,
  plans,
  planId,
}: {
  filters: RecommendationFilters;
  plans: ItineraryPlanSummary[];
  planId?: string;
}) {
  return (
    <Form action={ROUTES.recommendations} className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="size-4 text-gold-600" aria-hidden="true" />
        <h2 className="font-semibold">Filters</h2>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid gap-2">
          <Label htmlFor="rec-from">From</Label>
          <Input id="rec-from" name="from" type="date" defaultValue={filters.from} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="rec-to">To</Label>
          <Input id="rec-to" name="to" type="date" defaultValue={filters.to} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="rec-party">Guests</Label>
          <Input id="rec-party" name="party" type="number" min={1} max={MAX_PARTY_SIZE} defaultValue={filters.partySize} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="rec-budget">Budget per guest</Label>
          <NativeSelect id="rec-budget" name="budget" defaultValue={filters.maxPricePerGuestMinor === null ? "any" : String(filters.maxPricePerGuestMinor)}>
            {BUDGET_OPTIONS.map((amount) => (
              <option key={amount ?? "any"} value={amount ?? "any"}>
                {amount === null ? "Any price" : `Up to ${formatPrice(amount)}`}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto_auto_auto] lg:items-end">
        <fieldset className="min-w-0">
          <legend className="text-sm font-semibold">Time of day</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {TIMES_OF_DAY.map((option) => (
              <label
                key={option.value}
                className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border bg-card px-3 text-sm has-checked:border-primary has-checked:bg-secondary"
              >
                <input
                  type="checkbox"
                  name="times"
                  value={option.value}
                  defaultChecked={filters.timesOfDay.includes(option.value)}
                  className="accent-forest-800"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-2">
          <Label htmlFor="rec-available">Seats</Label>
          <NativeSelect id="rec-available" name="available" defaultValue={filters.availableOnly ? "1" : "0"} className="lg:w-52">
            <option value="1">Enough seats for us</option>
            <option value="0">Include full sessions</option>
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="rec-plan">Plan</Label>
          <NativeSelect id="rec-plan" name="plan" defaultValue={planId ?? ""} className="lg:w-48">
            <option value="">{plans.length ? "Latest plan" : "New plan"}</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="rec-conflicts">Schedule</Label>
          <NativeSelect id="rec-conflicts" name="conflicts" defaultValue={filters.avoidConflicts ? "1" : "0"} className="lg:w-52">
            <option value="1">Skip clashes with my plan</option>
            <option value="0">Show clashing sessions</option>
          </NativeSelect>
        </div>
      </div>
      <div className="mt-5 flex justify-end">
        <Button type="submit">Update recommendations</Button>
      </div>
    </Form>
  );
}
