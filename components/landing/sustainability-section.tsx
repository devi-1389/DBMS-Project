import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Backpack, Bike, Droplets, HandHeart, Sprout, Sun } from "lucide-react";

import { SectionHeading } from "@/components/landing/section-heading";
import { Button } from "@/components/ui/button";
import { categoryHref, SECTION_IDS } from "@/lib/navigation";

const ICONS = { sun: Sun, droplets: Droplets, sprout: Sprout, "hand-heart": HandHeart, backpack: Backpack, bike: Bike };

export function SustainabilitySection({
  pillars,
}: {
  pillars: ReadonlyArray<{ icon: keyof typeof ICONS; title: string; description: string }>;
}) {
  return (
    <section
      id={SECTION_IDS.sustainability}
      aria-labelledby="sustainability-title"
      className="scroll-mt-20 bg-forest-900 py-24 text-ivory-50 sm:py-32"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:px-10">
        <div className="reveal relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-3xl lg:max-w-none">
          <Image
            src="/images/placeholder/sustainability.webp"
            alt="Illustration of morning light falling through tall forest trees onto young sprouts"
            fill
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-forest-950/70 via-transparent to-transparent"
          />
          <p className="absolute right-6 bottom-6 left-6 font-display text-2xl leading-snug text-ivory-50 italic sm:text-3xl">
            “The most luxurious thing we can offer is a wild place that stays wild.”
          </p>
        </div>

        <div>
          <SectionHeading
            id="sustainability-title"
            tone="dark"
            eyebrow="Sustainability & shared resources"
            title="Luxury that gives back to the land"
            description="Low-impact design runs through every stay and every experience, from how the lights stay on and the gear you share to who hosts your supper."
          />
          <ul className="mt-12 grid gap-x-10 gap-y-9 sm:grid-cols-2">
            {pillars.map((pillar) => {
              const Icon = ICONS[pillar.icon];
              return (
                <li key={pillar.title} className="reveal">
                  <span className="inline-flex size-11 items-center justify-center rounded-full border border-gold-400/40 text-gold-300">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{pillar.title}</h3>
                  <p className="mt-1.5 leading-relaxed text-ivory-100/70">{pillar.description}</p>
                </li>
              );
            })}
          </ul>
          <Button asChild variant="inverse" size="lg" className="reveal mt-12">
            <Link href={categoryHref("sustainability")}>
              See sustainability experiences
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
