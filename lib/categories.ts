export const EXPERIENCE_CATEGORIES = [
  "luxury",
  "nature",
  "adventure",
  "wellness",
  "local-culture",
  "sustainability",
] as const;

export type ExperienceCategory = (typeof EXPERIENCE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ExperienceCategory, string> = {
  luxury: "Luxury",
  nature: "Nature",
  adventure: "Adventure",
  wellness: "Wellness",
  "local-culture": "Local Experiences",
  sustainability: "Sustainability",
};

export function isExperienceCategory(value: unknown): value is ExperienceCategory {
  return typeof value === "string" && (EXPERIENCE_CATEGORIES as readonly string[]).includes(value);
}
