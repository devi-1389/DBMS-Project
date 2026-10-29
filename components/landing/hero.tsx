import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ROUTES, SECTION_IDS } from "@/lib/navigation";

const pillars = ["Six experience worlds", "Matched to you by LUXE-ECO", "Shared, low-impact resources"];

export function Hero() {
  return (
    <section
      id={SECTION_IDS.top}
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-[100svh] items-end overflow-hidden bg-forest-950 text-ivory-50"
    >
      <Image
        src="/images/placeholder/hero.webp"
        alt=""
        fill
        preload
        sizes="100vw"
        className="-z-20 object-cover motion-safe:animate-hero-zoom"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-b from-forest-950/75 via-forest-950/25 to-forest-950/90"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-r from-forest-950/70 via-forest-950/20 to-transparent"
      />

      <div className="mx-auto w-full max-w-7xl px-6 pt-36 pb-20 sm:pb-28 lg:px-10">
        <p className="eyebrow text-gold-300 motion-safe:animate-fade-up">SOLACE · Luxury · Nature · Adventure</p>
        <h1
          id="hero-title"
          className="mt-6 max-w-4xl font-display text-5xl leading-[0.98] font-medium text-balance motion-safe:animate-fade-up motion-safe:[animation-delay:120ms] sm:text-7xl lg:text-8xl"
        >
          Where wild places meet <em className="text-gold-300">quiet luxury</em>.
        </h1>
        <p className="mt-8 max-w-xl text-lg leading-relaxed text-ivory-100/85 motion-safe:animate-fade-up motion-safe:[animation-delay:240ms] sm:text-xl">
          Curated experiences across forest, water and mountain, matched to the way you like to
          travel and hosted with care for the land that holds them.
        </p>
        <div className="mt-10 flex flex-col gap-4 motion-safe:animate-fade-up motion-safe:[animation-delay:360ms] sm:flex-row">
          <Button asChild variant="accent" size="xl">
            <Link href={ROUTES.experiences}>
              Explore experiences
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="inverse" size="xl">
            <Link href={`/#${SECTION_IDS.matching}`}>How matching works</Link>
          </Button>
        </div>
        <ul className="mt-14 flex flex-wrap gap-x-8 gap-y-3 border-t border-ivory-50/15 pt-6 text-sm text-ivory-100/75 motion-safe:animate-fade-up motion-safe:[animation-delay:480ms]">
          {pillars.map((pillar) => (
            <li key={pillar} className="flex items-center gap-3">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-gold-400" />
              {pillar}
            </li>
          ))}
        </ul>
      </div>

      <Link
        href={`/#${SECTION_IDS.categories}`}
        className="absolute right-6 bottom-8 hidden flex-col items-center gap-3 text-[0.65rem] font-semibold tracking-[0.3em] text-ivory-100/70 uppercase transition-colors hover:text-gold-300 sm:flex lg:right-10"
      >
        Scroll
        <span aria-hidden="true" className="h-14 w-px overflow-hidden bg-ivory-50/25">
          <span className="block h-full w-full bg-gold-300 motion-safe:animate-scroll-cue" />
        </span>
      </Link>
    </section>
  );
}
