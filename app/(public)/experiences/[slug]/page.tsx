import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Accessibility, Check, Clock, Gauge, MapPin, MessageSquareText, Users, UserRound } from "lucide-react";

import { BookingPanel } from "@/components/booking/booking-panel";
import { EmptyState } from "@/components/common/empty-state";
import { CategoryBadge } from "@/components/experiences/category-badge";
import { ExperienceCard } from "@/components/experiences/experience-card";
import { Breadcrumbs } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABELS } from "@/lib/categories";
import { formatDifficulty, formatDuration, formatPrice } from "@/lib/format";
import { INTEREST_LABELS } from "@/lib/interests";
import { categoryHref, experienceHref, ROUTES } from "@/lib/navigation";
// PLACEHOLDER data until the DAL exists (Phase 5).
import { getExperience, listExperiences, listSlots } from "@/lib/placeholder/catalogue";

export async function generateStaticParams() {
  const experiences = await listExperiences();
  return experiences.map((experience) => ({ slug: experience.slug }));
}

export async function generateMetadata({ params }: PageProps<"/experiences/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const experience = await getExperience(slug);
  return experience
    ? { title: experience.title, description: experience.summary }
    : { title: "Experience not found" };
}

export default async function ExperiencePage({ params }: PageProps<"/experiences/[slug]">) {
  const { slug } = await params;
  const experience = await getExperience(slug);
  if (!experience) notFound();

  const [slots, all] = await Promise.all([listSlots(slug), listExperiences()]);
  const related = all
    .filter((other) => other.slug !== slug)
    .map((other) => ({
      other,
      score:
        Number(other.category === experience.category) * 2 +
        other.interests.filter((interest) => experience.interests.includes(interest)).length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ other }) => other);

  const facts = [
    { icon: Clock, label: "Duration", value: formatDuration(experience.durationMinutes) },
    { icon: Gauge, label: "Difficulty", value: formatDifficulty(experience.difficulty) },
    { icon: Users, label: "Group size", value: `Up to ${experience.maxGroupSize} guests` },
    { icon: UserRound, label: "Minimum age", value: `${experience.minAge}+` },
    { icon: MapPin, label: "Meeting point", value: experience.meetingPoint },
    { icon: Accessibility, label: "Access", value: experience.accessible ? "Step-free access" : "Uneven terrain" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-6 pt-10 pb-24 lg:px-10">
      <Breadcrumbs
        items={[
          { label: "Experiences", href: ROUTES.experiences },
          { label: CATEGORY_LABELS[experience.category], href: categoryHref(experience.category) },
          { label: experience.title },
        ]}
      />

      <div className="relative mt-6 aspect-[4/3] overflow-hidden rounded-3xl bg-forest-900 sm:aspect-[21/9]">
        <Image
          src={experience.image.src}
          alt={experience.image.alt}
          fill
          preload
          sizes="(min-width: 1280px) 1200px, 100vw"
          className="object-cover"
        />
        <CategoryBadge category={experience.category} className="absolute top-5 left-5" />
      </div>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_24rem] lg:gap-16">
        <div className="min-w-0">
          <p className="eyebrow text-gold-700">{experience.location}</p>
          <h1 className="mt-3 font-display text-4xl leading-[1.05] font-medium text-balance sm:text-6xl">
            {experience.title}
          </h1>
          <p className="mt-5 max-w-2xl text-xl leading-relaxed text-pretty text-muted-foreground">
            {experience.summary}
          </p>
          <ul className="mt-6 flex flex-wrap gap-2" aria-label="Interests">
            {experience.interests.map((interest) => (
              <li key={interest}>
                <Badge variant="secondary">{INTEREST_LABELS[interest]}</Badge>
              </li>
            ))}
          </ul>

          <dl className="mt-10 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {facts.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-3 bg-card p-5">
                <Icon className="mt-0.5 size-5 shrink-0 text-gold-600" aria-hidden="true" />
                <div>
                  <dt className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{label}</dt>
                  <dd className="mt-1 font-semibold">{value}</dd>
                </div>
              </div>
            ))}
          </dl>

          <section aria-labelledby="overview-title" className="mt-12">
            <h2 id="overview-title" className="font-display text-3xl font-semibold">
              Overview
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed">{experience.description}</p>
            <h3 className="eyebrow mt-8 text-gold-700">Highlights</h3>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {experience.highlights.map((highlight) => (
                <li key={highlight} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-forest-700">
                    <Check className="size-3" aria-hidden="true" />
                  </span>
                  {highlight}
                </li>
              ))}
            </ul>
            <p className="mt-8 text-sm text-muted-foreground">
              From {formatPrice(experience.priceFromMinor, experience.currency)}
              {experience.priceFromMinor > 0 && " per guest"}. Sample price.
            </p>
          </section>

          <section aria-labelledby="reviews-title" className="mt-12">
            <h2 id="reviews-title" className="font-display text-3xl font-semibold">
              Guest reviews
            </h2>
            <EmptyState
              icon={MessageSquareText}
              title="No reviews yet"
              description="Reviews will come from guests who have completed this experience, once bookings are live."
              className="mt-6"
            />
          </section>
        </div>

        <div className="lg:sticky lg:top-28 lg:self-start">
          <BookingPanel experience={experience} slots={slots} />
        </div>
      </div>

      <section aria-labelledby="related-title" className="mt-20 border-t pt-14">
        <h2 id="related-title" className="font-display text-3xl font-semibold sm:text-4xl">
          You might also like
        </h2>
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((other) => (
            <li key={other.slug}>
              <ExperienceCard experience={other} href={experienceHref(other.slug)} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
