// Client-side form checks for the preview. Server-side validation (Zod, shared with
// Server Actions) replaces these when the backend exists; see the plan §4.
import { isExperienceCategory } from "@/lib/categories";
import { isDifficulty } from "@/lib/difficulty";

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SignInValues = { email: string; password: string };

export function validateSignIn(values: SignInValues): FieldErrors<keyof SignInValues> {
  const errors: FieldErrors<keyof SignInValues> = {};
  if (!EMAIL.test(values.email.trim())) errors.email = "Enter a valid email address.";
  if (!values.password) errors.password = "Enter your password.";
  return errors;
}

export type SignUpValues = { name: string; email: string; password: string; terms: boolean };

export function validateSignUp(values: SignUpValues): FieldErrors<keyof SignUpValues> {
  const errors: FieldErrors<keyof SignUpValues> = {};
  if (values.name.trim().length < 2) errors.name = "Enter your name.";
  if (!EMAIL.test(values.email.trim())) errors.email = "Enter a valid email address.";
  if (values.password.length < 8) errors.password = "Use at least 8 characters.";
  if (!values.terms) errors.terms = "Please accept the terms to continue.";
  return errors;
}

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
  if (!inRange(values.price, 0, 5000)) errors.price = "Enter a price from 0 to 5,000.";
  if (!inRange(values.capacity, 1, 40) || !Number.isInteger(Number(values.capacity))) {
    errors.capacity = "Enter a whole number from 1 to 40.";
  }
  const summary = values.summary.trim();
  if (summary.length < 10 || summary.length > 160) errors.summary = "Use 10 to 160 characters.";
  return errors;
}
