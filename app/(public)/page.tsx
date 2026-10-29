import { CategoriesSection } from "@/components/landing/categories-section";
import { ClosingCta } from "@/components/landing/closing-cta";
import { FeaturedExperiencesSection } from "@/components/landing/featured-experiences-section";
import { Hero } from "@/components/landing/hero";
import { MatchingSection } from "@/components/landing/matching-section";
import { SustainabilitySection } from "@/components/landing/sustainability-section";
// PLACEHOLDER data until the DAL exists (Phase 5).
import { listExperiences } from "@/lib/placeholder/catalogue";
import { categoryHighlights, matchingExample, sustainabilityPillars } from "@/lib/placeholder/landing";

export default async function HomePage() {
  const experiences = await listExperiences();
  const matchExperience = experiences.find(
    (experience) => experience.slug === matchingExample.experienceSlug,
  );

  return (
    <>
      <Hero />
      <CategoriesSection categories={categoryHighlights} />
      <FeaturedExperiencesSection experiences={experiences} />
      {matchExperience && (
        <MatchingSection
          example={{
            experience: matchExperience,
            preferences: matchingExample.preferences,
            reasons: matchingExample.reasons,
          }}
        />
      )}
      <SustainabilitySection pillars={sustainabilityPillars} />
      <ClosingCta />
    </>
  );
}
