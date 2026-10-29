export const DIFFICULTIES = ["easy", "moderate", "challenging"] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  moderate: "Moderate",
  challenging: "Challenging",
};

export const DIFFICULTY_RANK: Record<Difficulty, number> = {
  easy: 1,
  moderate: 2,
  challenging: 3,
};

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === "string" && (DIFFICULTIES as readonly string[]).includes(value);
}
