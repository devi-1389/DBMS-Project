// PLACEHOLDER: operational sample data used only by the development seed.
// Experiences, sessions and sample bookings are NOT repeated here; the seed reads
// them from lib/placeholder/catalogue.ts. Names, emails and IDs are invented and use
// the reserved example.com domain. Never seed this into production.
import type { InterestId } from "@/lib/interests";

type SupplierKind = "activity_operator" | "local_host" | "equipment_rental" | "food_producer" | "transport";
type ResourceKind = "vehicle" | "watercraft" | "equipment" | "venue" | "other";

export const admin = { email: "admin@example.com", displayName: "Resort admin (sample)" };

export const suppliers: {
  name: string;
  kind: SupplierKind;
  contactEmail: string;
  /** Experiences this supplier operates or hosts. */
  experiences: string[];
}[] = [
  {
    name: "Valley Hosts Cooperative",
    kind: "local_host",
    contactEmail: "hello@valley-hosts.example.com",
    experiences: ["village-harvest-table", "artisan-craft-workshop"],
  },
  {
    name: "Ridge Line Adventures",
    kind: "activity_operator",
    contactEmail: "ops@ridge-adventures.example.com",
    experiences: ["canopy-zipline-circuit"],
  },
  { name: "Lakeside Outfitters", kind: "equipment_rental", contactEmail: "rentals@lakeside.example.com", experiences: [] },
  { name: "Green Valley Transport", kind: "transport", contactEmail: "dispatch@gv-transport.example.com", experiences: [] },
];

/** `leads`: experiences this person leads. Chosen so no one has overlapping sessions. */
export const staff: {
  key: string;
  displayName: string;
  jobTitle: string;
  email: string;
  hasAccount: boolean;
  hiredOn: string;
  leads: string[];
}[] = [
  { key: "mara", displayName: "Mara Ellis", jobTitle: "Lead naturalist", email: "mara@example.com", hasAccount: true, hiredOn: "2023-03-01", leads: ["river-wildlife-canoe", "starlit-observatory"] },
  { key: "tomas", displayName: "Tomás Reyes", jobTitle: "Forest guide", email: "tomas@example.com", hasAccount: false, hiredOn: "2024-04-15", leads: ["old-growth-forest-trail"] },
  { key: "ines", displayName: "Inès Laurent", jobTitle: "Mountain guide", email: "ines@example.com", hasAccount: false, hiredOn: "2022-06-01", leads: ["ridge-line-summit-trek"] },
  { key: "kai", displayName: "Kai Andersen", jobTitle: "Adventure instructor", email: "kai@example.com", hasAccount: false, hiredOn: "2025-01-10", leads: ["canopy-zipline-circuit"] },
  { key: "leila", displayName: "Leila Haddad", jobTitle: "Wellness lead", email: "leila@example.com", hasAccount: false, hiredOn: "2023-09-01", leads: ["lakeside-sunrise-yoga", "forest-thermal-ritual"] },
  { key: "arun", displayName: "Arun Mehta", jobTitle: "Executive chef", email: "arun@example.com", hasAccount: false, hiredOn: "2021-11-01", leads: ["canopy-sunset-dining"] },
  { key: "sofia", displayName: "Sofia Okoro", jobTitle: "Community host", email: "sofia@example.com", hasAccount: false, hiredOn: "2024-02-01", leads: ["village-harvest-table", "artisan-craft-workshop"] },
  { key: "noah", displayName: "Noah Fischer", jobTitle: "Restoration lead", email: "noah@example.com", hasAccount: true, hiredOn: "2022-08-15", leads: ["reforestation-morning", "behind-the-green-scenes"] },
];

export const resources: { name: string; kind: ResourceKind; quantity: number; location: string; supplier?: string }[] = [
  { name: "Two-person canoe", kind: "watercraft", quantity: 6, location: "Boathouse", supplier: "Lakeside Outfitters" },
  { name: "Observatory telescope", kind: "equipment", quantity: 2, location: "Observation Deck" },
  { name: "Electric shuttle van", kind: "vehicle", quantity: 2, location: "Main lodge", supplier: "Green Valley Transport" },
  { name: "Zipline harness kit", kind: "equipment", quantity: 12, location: "Adventure centre", supplier: "Ridge Line Adventures" },
  { name: "Lake yoga deck", kind: "venue", quantity: 1, location: "Lake Deck" },
  { name: "Thermal house", kind: "venue", quantity: 1, location: "Thermal House" },
  { name: "Lakeside pavilion", kind: "venue", quantity: 1, location: "Lakeside Pavilion" },
  { name: "Makers' studio", kind: "venue", quantity: 1, location: "Makers' studios" },
  { name: "Planting tool kit", kind: "equipment", quantity: 20, location: "Nursery barn" },
];

export const requirements: {
  experience: string;
  resource: string;
  basis: "per_session" | "per_guest";
  quantity: number;
}[] = [
  { experience: "river-wildlife-canoe", resource: "Two-person canoe", basis: "per_session", quantity: 4 },
  { experience: "starlit-observatory", resource: "Observatory telescope", basis: "per_session", quantity: 2 },
  { experience: "ridge-line-summit-trek", resource: "Electric shuttle van", basis: "per_session", quantity: 1 },
  { experience: "reforestation-morning", resource: "Electric shuttle van", basis: "per_session", quantity: 1 },
  { experience: "village-harvest-table", resource: "Electric shuttle van", basis: "per_session", quantity: 1 },
  { experience: "canopy-zipline-circuit", resource: "Zipline harness kit", basis: "per_guest", quantity: 1 },
  { experience: "lakeside-sunrise-yoga", resource: "Lake yoga deck", basis: "per_session", quantity: 1 },
  { experience: "forest-thermal-ritual", resource: "Thermal house", basis: "per_session", quantity: 1 },
  { experience: "canopy-sunset-dining", resource: "Lakeside pavilion", basis: "per_session", quantity: 1 },
  { experience: "artisan-craft-workshop", resource: "Makers' studio", basis: "per_session", quantity: 1 },
  { experience: "reforestation-morning", resource: "Planting tool kit", basis: "per_guest", quantity: 1 },
];

/** Windows chosen to leave enough units for the sample schedule. */
export const maintenance = [
  { resource: "Electric shuttle van", startsAt: "2026-11-10T00:00:00.000Z", endsAt: "2026-11-11T00:00:00.000Z", quantityOut: 1, reason: "Scheduled battery service" },
  { resource: "Two-person canoe", startsAt: "2026-11-12T00:00:00.000Z", endsAt: "2026-11-14T00:00:00.000Z", quantityOut: 2, reason: "Hull repairs" },
];

/** `experience: null` = resort-wide. Seeded sessions inside a blackout are stored as cancelled. */
export const blackouts: { experience: string | null; startsAt: string; endsAt: string; reason: string }[] = [
  { experience: "ridge-line-summit-trek", startsAt: "2026-11-14T00:00:00.000Z", endsAt: "2026-11-15T00:00:00.000Z", reason: "Ridge path closed for trail repairs" },
  { experience: null, startsAt: "2026-11-16T00:00:00.000Z", endsAt: "2026-11-17T00:00:00.000Z", reason: "Resort closed for annual staff day" },
];

/** Guest-name → email for the guests named in the catalogue's sample bookings. */
export function guestEmail(name: string) {
  return `${name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@example.com`;
}

export const sampleGuestPreferences = {
  guestName: "Sample guest",
  interests: [
    { id: "wildlife", weight: 5 },
    { id: "water", weight: 4 },
    { id: "mindfulness", weight: 3 },
  ] satisfies { id: InterestId; weight: number }[],
  maxDifficulty: "easy" as const,
  budgetPerGuestMinor: 15_000,
  usualGroupSize: 2,
  timesOfDay: ["morning" as const],
  needsStepFree: false,
  notes: "Celebrating an anniversary (sample).",
};

/** Payment attempts by booking reference. */
export const payments: Record<
  string,
  { method: "pay_at_resort" | "card"; status: "initiated" | "succeeded" | "failed"; recordedBy?: string; failureReason?: string }
> = {
  "LX-6RJ3": { method: "pay_at_resort", status: "succeeded", recordedBy: "tomas" },
  "LX-8TB2": { method: "card", status: "succeeded" },
  "LX-2MW9": { method: "card", status: "initiated" },
  "LX-9PD5": { method: "card", status: "failed", failureReason: "Card declined (sample)" },
  "LX-7CN1": { method: "card", status: "succeeded" },
};

export const reviews: Record<string, { rating: number; title: string; body: string }> = {
  "LX-6RJ3": {
    rating: 5,
    title: "A forest that talks back",
    body: "Our guide knew every bird call. Sample review for development data.",
  },
};

/** The sample guest's itinerary draft. `booked` links an item to that booking reference. */
export const itinerary = {
  guestName: "Sample guest",
  name: "November stay",
  arrival: "2026-11-02",
  departure: "2026-11-05",
  items: [
    { experience: "lakeside-sunrise-yoga", startsAt: "2026-11-03T07:00:00.000Z", partySize: 2, booked: "LX-4KQ7" },
    { experience: "river-wildlife-canoe", startsAt: "2026-11-04T06:30:00.000Z", partySize: 2 },
    { experience: "canopy-sunset-dining", startsAt: "2026-11-05T17:30:00.000Z", partySize: 2, booked: "LX-8TB2" },
  ],
};
