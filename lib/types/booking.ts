import type { ExperienceCategory } from "@/lib/categories";

export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed" | "no_show";

export type BookingSummary = {
  reference: string;
  experienceSlug: string;
  experienceTitle: string;
  category: ExperienceCategory;
  startsAt: string;
  endsAt: string;
  partySize: number;
  totalMinor: number;
  currency: string;
  status: BookingStatus;
  guestName: string;
};
