"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Info, Save, Sparkles } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { QuantityInput } from "@/components/common/quantity-input";
import { ToggleChip } from "@/components/common/toggle-chip";
import { MatchCard, MatchListSkeleton } from "@/components/preferences/match-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DIFFICULTIES, DIFFICULTY_LABELS, type Difficulty } from "@/lib/difficulty";
import { formatPrice, formatTime } from "@/lib/format";
import { INTERESTS } from "@/lib/interests";
import { rankExperiences } from "@/lib/matching/score";
import { ROUTES } from "@/lib/navigation";
import {
  BUDGET_OPTIONS,
  DEFAULT_PREFERENCES,
  GROUP_SIZE_LIMITS,
  NOTES_MAX_LENGTH,
  TIMES_OF_DAY,
  validatePreferences,
  type PreferencesErrors,
} from "@/lib/preferences";
import { preferencesStore, usePreviewStore } from "@/lib/preview-store";
import type { ExperienceSlot, ExperienceSummary } from "@/lib/types/experience";
import type { GuestPreferences } from "@/lib/types/guest";
import { cn } from "@/lib/utils";

const PACE_HINTS: Record<Difficulty, string> = {
  easy: "Gentle, mostly level and unhurried",
  moderate: "Some hills and a few hours on your feet",
  challenging: "Long days and steep terrain",
};

type CatalogueProps = { experiences: ExperienceSummary[]; slots: ExperienceSlot[] };

export function PreferencesPlanner(props: CatalogueProps) {
  const [stored, setStored] = usePreviewStore(preferencesStore);

  if (stored === undefined) return <PreferencesSkeleton />;

  return (
    <PreferencesForm
      // Re-initialise the draft from storage after each save or clear.
      key={stored?.updatedAt ?? "unsaved"}
      {...props}
      initial={stored ?? DEFAULT_PREFERENCES}
      saved={stored}
      onSave={setStored}
    />
  );
}

const comparable = (preferences: GuestPreferences) => JSON.stringify({ ...preferences, updatedAt: null });

function PreferencesForm({
  experiences,
  slots,
  initial,
  saved,
  onSave,
}: CatalogueProps & {
  initial: GuestPreferences;
  saved: GuestPreferences | null;
  onSave: (value: GuestPreferences | null) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<PreferencesErrors>({});
  const matches = useMemo(() => rankExperiences(experiences, slots, draft, 3), [experiences, slots, draft]);

  const dirty = saved ? comparable(draft) !== comparable(saved) : comparable(draft) !== comparable(DEFAULT_PREFERENCES);
  const update = (patch: Partial<GuestPreferences>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[key as keyof PreferencesErrors];
      return next;
    });
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const found = validatePreferences(draft);
    setErrors(found);
    if (Object.keys(found).length) {
      document.getElementById(`pref-${Object.keys(found)[0]}`)?.focus();
      return;
    }
    onSave({ ...draft, updatedAt: new Date().toISOString() });
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_24rem] lg:gap-14">
      <form onSubmit={submit} noValidate className="space-y-6" aria-describedby="preferences-storage-note">
        <Section
          id="pref-interests"
          title="What do you love?"
          description="Pick as many as you like. These carry the most weight."
          error={errors.interests}
        >
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((interest) => (
              <ToggleChip
                key={interest.id}
                pressed={draft.interests.includes(interest.id)}
                onPressedChange={(on) =>
                  update({
                    interests: on
                      ? [...draft.interests, interest.id]
                      : draft.interests.filter((id) => id !== interest.id),
                  })
                }
              >
                {interest.label}
              </ToggleChip>
            ))}
          </div>
        </Section>

        <Section id="pref-pace" title="Your pace" description="We won't suggest anything harder than this.">
          <RadioGroup
            value={draft.pace}
            onValueChange={(value) => update({ pace: value as Difficulty })}
            className="grid gap-3 sm:grid-cols-3"
            aria-label="Pace"
          >
            {DIFFICULTIES.map((difficulty) => (
              <OptionCard key={difficulty} id={`pace-${difficulty}`} value={difficulty} title={DIFFICULTY_LABELS[difficulty]} hint={PACE_HINTS[difficulty]} />
            ))}
          </RadioGroup>
        </Section>

        <Section id="pref-budget" title="Budget per experience" description="Per guest. Complimentary experiences always fit.">
          <RadioGroup
            value={draft.budgetMaxMinor === null ? "none" : String(draft.budgetMaxMinor)}
            onValueChange={(value) => update({ budgetMaxMinor: value === "none" ? null : Number(value) })}
            className="grid gap-3 sm:grid-cols-4"
            aria-label="Budget per experience"
          >
            {BUDGET_OPTIONS.map((amount) => {
              const value = amount === null ? "none" : String(amount);
              return (
                <OptionCard
                  key={value}
                  id={`budget-${value}`}
                  value={value}
                  title={amount === null ? "No limit" : `Up to ${formatPrice(amount)}`}
                />
              );
            })}
          </RadioGroup>
        </Section>

        <Section id="pref-groupSize" title="Group and timing" error={errors.groupSize}>
          <QuantityInput
            label="Usually travelling as"
            description="Experiences that can't fit your group are left out."
            value={draft.groupSize}
            min={GROUP_SIZE_LIMITS.min}
            max={GROUP_SIZE_LIMITS.max}
            onChange={(groupSize) => update({ groupSize })}
          />
          <div className="mt-6 border-t pt-6">
            <p className="text-sm font-semibold">Best time of day</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {TIMES_OF_DAY.map((option) => (
                <ToggleChip
                  key={option.value}
                  pressed={draft.timesOfDay.includes(option.value)}
                  onPressedChange={(on) =>
                    update({
                      timesOfDay: on
                        ? [...draft.timesOfDay, option.value]
                        : draft.timesOfDay.filter((value) => value !== option.value),
                    })
                  }
                >
                  {option.label}
                  <span className="text-xs opacity-75">{option.hint}</span>
                </ToggleChip>
              ))}
            </div>
          </div>
        </Section>

        <Section id="pref-notes" title="Access and notes" error={errors.notes}>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="pref-accessibility" className="leading-snug font-medium">
              I need step-free access
            </Label>
            <Switch
              id="pref-accessibility"
              checked={draft.needsAccessibility}
              onCheckedChange={(needsAccessibility) => update({ needsAccessibility })}
            />
          </div>
          <div className="mt-6 grid gap-2 border-t pt-6">
            <Label htmlFor="pref-notes-input">Anything else we should know?</Label>
            <Textarea
              id="pref-notes-input"
              value={draft.notes}
              maxLength={NOTES_MAX_LENGTH + 50}
              onChange={(event) => update({ notes: event.target.value })}
              placeholder="Dietary needs, celebrations, things you'd rather avoid…"
              aria-invalid={Boolean(errors.notes)}
              aria-describedby="pref-notes-count"
            />
            <p
              id="pref-notes-count"
              className={cn("text-right text-xs", draft.notes.length > NOTES_MAX_LENGTH ? "text-destructive" : "text-muted-foreground")}
            >
              {draft.notes.length} / {NOTES_MAX_LENGTH}
            </p>
          </div>
        </Section>

        <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl border bg-card/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p id="preferences-storage-note" aria-live="polite" className="text-sm text-muted-foreground">
            {dirty
              ? "Unsaved changes."
              : saved?.updatedAt
                ? `Saved in this browser at ${formatTime(saved.updatedAt)}.`
                : "Not saved yet."}{" "}
            Stored in this browser only, not in an account.
          </p>
          <div className="flex gap-2">
            {saved && (
              <Button type="button" variant="ghost" onClick={() => onSave(null)}>
                Clear saved
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => setDraft(DEFAULT_PREFERENCES)} disabled={!dirty && !saved}>
              Reset
            </Button>
            <Button type="submit">
              <Save />
              Save preferences
            </Button>
          </div>
        </div>
      </form>

      <aside aria-labelledby="matches-title" className="lg:sticky lg:top-28 lg:self-start">
        <div className="rounded-3xl border bg-ivory-200/60 p-6">
          <h2 id="matches-title" className="flex items-center gap-2 font-display text-2xl font-semibold">
            <Sparkles className="size-5 text-gold-600" aria-hidden="true" />
            Your top matches
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Updates as you choose, from the sample catalogue.</p>
          <div className="mt-6" aria-live="polite">
            {draft.interests.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="Pick an interest"
                description="Choose at least one interest to see experiences ranked for you."
                className="bg-card py-10"
              />
            ) : matches.length === 0 ? (
              <EmptyState
                icon={Info}
                title="Nothing fits yet"
                description="Try a higher pace, a larger budget or a smaller group."
                className="bg-card py-10"
              />
            ) : (
              <ol className="space-y-4">
                {matches.map((match, index) => (
                  <li key={match.experience.slug}>
                    <MatchCard match={match} rank={index + 1} />
                  </li>
                ))}
              </ol>
            )}
          </div>
          <Alert variant="default" className="mt-6 bg-card">
            <Info aria-hidden="true" />
            <AlertTitle>How matching works</AlertTitle>
            <AlertDescription>
              <p>
                Shared interests count most, then pace, budget and time of day. Accessibility and group size are firm
                limits. <Link href={ROUTES.experiences} className="font-semibold text-foreground underline underline-offset-4">Browse everything</Link>
              </p>
            </AlertDescription>
          </Alert>
        </div>
      </aside>
    </div>
  );
}

function Section({
  id,
  title,
  description,
  error,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      aria-describedby={error ? `${id}-error` : undefined}
      className={cn("rounded-2xl border bg-card p-6 shadow-sm sm:p-7", error && "border-destructive/50")}
    >
      {/* Focus target when validation fails. */}
      <h2 id={id} tabIndex={-1} className="font-display text-2xl font-semibold outline-none">
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-3 text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function OptionCard({ id, value, title, hint }: { id: string; value: string; title: string; hint?: string }) {
  return (
    <Label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-4 font-normal transition-colors hover:bg-secondary/60 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-secondary"
    >
      <RadioGroupItem id={id} value={value} className="mt-0.5" />
      <span className="grid gap-1">
        <span className="font-semibold">{title}</span>
        {hint && <span className="text-xs leading-snug text-muted-foreground">{hint}</span>}
      </span>
    </Label>
  );
}

function PreferencesSkeleton() {
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_24rem] lg:gap-14" role="status" aria-label="Loading preferences">
      <div className="space-y-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border bg-card p-7">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="mt-3 h-4 w-72" />
            <div className="mt-6 flex flex-wrap gap-2">
              {Array.from({ length: 6 }, (_, j) => (
                <Skeleton key={j} className="h-10 w-28 rounded-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <MatchListSkeleton />
    </div>
  );
}
