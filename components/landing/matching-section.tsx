import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";

import { CategoryBadge } from "@/components/experiences/category-badge";
import { ExperienceMeta } from "@/components/experiences/experience-meta";
import { SectionHeading } from "@/components/landing/section-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROUTES, SECTION_IDS } from "@/lib/navigation";
import type { ExperienceSummary } from "@/lib/types/experience";

// The LUXE-ECO flow: preferences → matching → availability → plan (booking and feedback follow).
const steps = [
  {
    title: "Share what moves you",
    description: "Interests, pace, budget, group size, accessibility needs and the times of day you prefer.",
  },
  {
    title: "LUXE-ECO weighs every experience",
    description: "Each one is scored against your preferences, and every score comes with plain reasons.",
  },
  {
    title: "Availability is checked for real",
    description: "Only sessions with seats, an assigned guide and the equipment or venue they need are suggested.",
  },
  {
    title: "Your days, planned",
    description: "Get a day-by-day plan that fits your stay and activity budget, then refine it any time.",
  },
];

export function MatchingSection({
  example,
}: {
  example: { experience: ExperienceSummary; preferences: string[]; reasons: string[] };
}) {
  return (
    <section
      id={SECTION_IDS.matching}
      aria-labelledby="matching-title"
      className="scroll-mt-20 overflow-hidden py-24 sm:py-32"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-16 px-6 lg:grid-cols-2 lg:gap-20 lg:px-10">
        <div>
          <SectionHeading
            id="matching-title"
            eyebrow="Personalised matching"
            title="Experiences chosen around you"
            description="Tell us how you like to travel. LUXE-ECO, the system behind every SOLACE stay, matches experiences to your preferences, budget and schedule, and shows exactly why each one made your shortlist."
          />
          <ol className="mt-12 space-y-8">
            {steps.map((step, index) => (
              <li key={step.title} className="reveal flex gap-6">
                <span
                  aria-hidden="true"
                  className="w-12 shrink-0 font-display text-4xl leading-none font-medium text-gold-600"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="border-l border-border pl-6">
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="mt-1.5 leading-relaxed text-muted-foreground">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="reveal mt-12 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Button asChild size="lg">
              <Link href={ROUTES.preferences}>
                Set your preferences
                <ArrowRight />
              </Link>
            </Button>
            <p className="text-sm text-muted-foreground">
              Preferences and plans are saved to your account. Book online and pay at the resort.
            </p>
          </div>
        </div>

        <MatchExample {...example} />
      </div>
    </section>
  );
}

function MatchExample({
  experience,
  preferences,
  reasons,
}: {
  experience: ExperienceSummary;
  preferences: string[];
  reasons: string[];
}) {
  return (
    <figure className="reveal relative mx-auto w-full max-w-md lg:max-w-none">
      <div
        aria-hidden="true"
        className="absolute inset-0 translate-x-4 translate-y-4 rotate-2 rounded-3xl bg-sage-200 sm:translate-x-6 sm:translate-y-6"
      />
      <div className="relative rounded-3xl border bg-card p-6 shadow-xl sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-gold-600" aria-hidden="true" />
            Your preferences
          </p>
          <Badge variant="outline" className="text-muted-foreground">
            Illustrative example
          </Badge>
        </div>
        <ul className="mt-4 flex flex-wrap gap-2">
          {preferences.map((preference) => (
            <li key={preference}>
              <Badge variant="secondary">{preference}</Badge>
            </li>
          ))}
        </ul>

        <div className="mt-6 overflow-hidden rounded-2xl border">
          <div className="relative aspect-[16/9] bg-forest-900">
            <Image
              src={experience.image.src}
              alt={experience.image.alt}
              fill
              sizes="(min-width: 1024px) 560px, 100vw"
              className="object-cover"
            />
            <CategoryBadge category={experience.category} className="absolute top-3 left-3" />
            <Badge variant="accent" className="absolute top-3 right-3">
              Top match
            </Badge>
          </div>
          <div className="p-5">
            <p className="font-display text-2xl font-semibold">{experience.title}</p>
            <ExperienceMeta experience={experience} className="mt-2" />
          </div>
        </div>

        <figcaption className="mt-6">
          <p className="eyebrow text-gold-700">Why it fits you</p>
          <ul className="mt-3 space-y-2.5">
            {reasons.map((reason) => (
              <li key={reason} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-forest-700">
                  <Check className="size-3" aria-hidden="true" />
                </span>
                {reason}
              </li>
            ))}
          </ul>
        </figcaption>
      </div>
    </figure>
  );
}
