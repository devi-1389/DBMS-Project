// Client-side checks for the admin "New experience" form (saving arrives in Phase 7).
// Data the server accepts is validated with the Zod schemas in ./schemas.ts.
import { isExperienceCategory } from "@/lib/categories";
import { isDifficulty } from "@/lib/difficulty";

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export type ExperienceFormValues = {
  title: string;
  category: string;
  difficulty: string;
  durationMinutes: string;
  price: string;
  capacity: string;
  summary: string;
};

export const EMPTY_EXPERIENCE_FORM: ExperienceFormValues = {
  title: "",
  category: "",
  difficulty: "",
  durationMinutes: "",
  price: "",
  capacity: "",
  summary: "",
};

const inRange = (value: string, min: number, max: number) => {
  const number = Number(value);
  return value.trim() !== "" && Number.isFinite(number) && number >= min && number <= max;
};

export function validateExperienceForm(values: ExperienceFormValues): FieldErrors<keyof ExperienceFormValues> {
  const errors: FieldErrors<keyof ExperienceFormValues> = {};
  const title = values.title.trim();
  if (title.length < 3 || title.length > 80) errors.title = "Use 3 to 80 characters.";
  if (!isExperienceCategory(values.category)) errors.category = "Choose a category.";
  if (!isDifficulty(values.difficulty)) errors.difficulty = "Choose a difficulty.";
  if (!inRange(values.durationMinutes, 30, 720) || !Number.isInteger(Number(values.durationMinutes))) {
    errors.durationMinutes = "Enter whole minutes between 30 and 720.";
  }
  if (!inRange(values.price, 0, 100000)) errors.price = "Enter a price from ₹0 to ₹1,00,000.";
  if (!inRange(values.capacity, 1, 40) || !Number.isInteger(Number(values.capacity))) {
    errors.capacity = "Enter a whole number from 1 to 40.";
  }
  const summary = values.summary.trim();
  if (summary.length < 10 || summary.length > 160) errors.summary = "Use 10 to 160 characters.";
  return errors;
}
