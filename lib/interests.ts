export const INTERESTS = [
  { id: "wildlife", label: "Wildlife" },
  { id: "water", label: "Lakes & water" },
  { id: "forest", label: "Forests" },
  { id: "mountains", label: "Mountains" },
  { id: "night-sky", label: "Night skies" },
  { id: "food", label: "Food & dining" },
  { id: "craft", label: "Craft & making" },
  { id: "community", label: "Local community" },
  { id: "mindfulness", label: "Mindfulness" },
  { id: "thrills", label: "Thrills" },
  { id: "conservation", label: "Conservation" },
] as const;

export type InterestId = (typeof INTERESTS)[number]["id"];

export const INTEREST_LABELS = Object.fromEntries(
  INTERESTS.map((interest) => [interest.id, interest.label]),
) as Record<InterestId, string>;

export function isInterestId(value: unknown): value is InterestId {
  return typeof value === "string" && INTERESTS.some((interest) => interest.id === value);
}
