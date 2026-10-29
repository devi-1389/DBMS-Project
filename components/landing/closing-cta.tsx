import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { LeafMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ROUTES, SECTION_IDS } from "@/lib/navigation";

export function ClosingCta() {
  return (
    <section aria-labelledby="closing-title" className="py-24 sm:py-32">
      <div className="reveal mx-auto max-w-3xl px-6 text-center">
        <LeafMark className="mx-auto size-12 text-gold-600" />
        <h2
          id="closing-title"
          className="mt-8 font-display text-4xl leading-[1.05] font-medium text-balance sm:text-6xl"
        >
          Begin with what moves you
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Find a category that feels right, or browse the experiences we are most excited to share.
        </p>
        <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
          <Button asChild size="xl">
            <Link href={ROUTES.experiences}>
              Explore experiences
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline" size="xl">
            <Link href={`/#${SECTION_IDS.categories}`}>Browse categories</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
