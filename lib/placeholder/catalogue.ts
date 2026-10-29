// PLACEHOLDER: the one sample-data module for the frontend phase. Nothing here is real
// inventory, availability or bookings. Titles, prices (USD), schedules, seat counts and
// guest names are invented. Images are generated illustrations.
// Replace these accessors with `server-only` DAL functions in Phase 5. Keep the same
// names and return types so pages only change their import.
import { addDays } from "@/lib/format";
import type { BookingStatus, BookingSummary } from "@/lib/types/booking";
import type { ExperienceSlot, ExperienceSummary } from "@/lib/types/experience";

/* ------------------------------------------------------------------ experiences */

const img = (slug: string, alt: string) => ({
  src: `/images/placeholder/experiences/${slug}.webp`,
  alt,
});

const experiences: ExperienceSummary[] = [
  {
    slug: "canopy-sunset-dining",
    title: "Canopy Sunset Dining",
    category: "luxury",
    summary: "A private tasting menu on a glass pavilion above the lake as the light turns gold.",
    description:
      "Your table is set on a cantilevered pavilion above the water. A seasonal tasting menu built from the resort garden and nearby farms is served course by course while the sun sets behind the ridge.",
    highlights: ["Seven-course seasonal menu", "Dedicated host and sommelier", "Lakeside pavilion for up to six guests"],
    interests: ["food", "water"],
    location: "Lakeside Pavilion",
    meetingPoint: "Main lodge terrace",
    accessible: true,
    durationMinutes: 180,
    difficulty: "easy",
    maxGroupSize: 6,
    minAge: 12,
    priceFromMinor: 42000,
    currency: "USD",
    image: img("canopy-sunset-dining", "Illustration of a glowing glass pavilion above a lake at sunset"),
    featured: true,
  },
  {
    slug: "starlit-observatory",
    title: "Starlit Observatory Evening",
    category: "luxury",
    summary: "Champagne, blankets and a guided tour of the night sky far from city light.",
    description:
      "After dark, a guide leads a small group to the observation deck for telescope viewing, stories of the constellations and warm drinks under the stars.",
    highlights: ["Guided telescope viewing", "Champagne or botanical tonic", "Heated blankets and loungers"],
    interests: ["night-sky"],
    location: "Observation Deck",
    meetingPoint: "Main lodge lobby",
    accessible: true,
    durationMinutes: 120,
    difficulty: "easy",
    maxGroupSize: 8,
    minAge: 8,
    priceFromMinor: 26000,
    currency: "USD",
    image: img("starlit-observatory", "Illustration of a lit pavilion in a forest under a starry night sky"),
    featured: false,
  },
  {
    slug: "old-growth-forest-trail",
    title: "Old-Growth Forest Trail",
    category: "nature",
    summary: "Walk among ancient trees with a naturalist who reads the forest like a book.",
    description:
      "A gentle guided walk through layered old-growth forest. Your naturalist points out tracks, birdsong and the fungi networks that connect the trees.",
    highlights: ["Small group with a naturalist", "Birdsong and wildlife spotting", "Forest tea at the trail's end"],
    interests: ["forest", "wildlife"],
    location: "Old-growth Reserve",
    meetingPoint: "Trailhead shelter",
    accessible: false,
    durationMinutes: 180,
    difficulty: "moderate",
    maxGroupSize: 10,
    minAge: 8,
    priceFromMinor: 9500,
    currency: "USD",
    image: img("old-growth-forest-trail", "Illustration of misty layered pine forest ridges in the morning"),
    featured: true,
  },
  {
    slug: "river-wildlife-canoe",
    title: "Dawn Wildlife Canoe",
    category: "nature",
    summary: "Glide across still water at first light while herons and otters wake.",
    description:
      "Set out by canoe as mist lifts off the lake. Your guide paddles you to quiet inlets where wildlife is most active in the early hours.",
    highlights: ["Two-person canoes with a guide", "Binoculars and field guides provided", "Lakeside breakfast basket"],
    interests: ["wildlife", "water"],
    location: "North Inlet",
    meetingPoint: "Boathouse",
    accessible: false,
    durationMinutes: 150,
    difficulty: "easy",
    maxGroupSize: 8,
    minAge: 10,
    priceFromMinor: 12000,
    currency: "USD",
    image: img("river-wildlife-canoe", "Illustration of two people paddling a canoe across a calm lake at dawn"),
    featured: false,
  },
  {
    slug: "ridge-line-summit-trek",
    title: "Ridge Line Summit Trek",
    category: "adventure",
    summary: "A full-day guided climb to a panoramic summit above the tree line.",
    description:
      "Climb steadily through forest and alpine meadow to the summit ridge, with a mountain guide setting the pace and a picnic lunch at the top.",
    highlights: ["Certified mountain guide", "Summit picnic lunch", "Poles and packs provided"],
    interests: ["mountains", "thrills"],
    location: "Ridge Line",
    meetingPoint: "Adventure centre",
    accessible: false,
    durationMinutes: 480,
    difficulty: "challenging",
    maxGroupSize: 8,
    minAge: 14,
    priceFromMinor: 18000,
    currency: "USD",
    image: img("ridge-line-summit-trek", "Illustration of sharp mountain peaks above a pine forest"),
    featured: true,
  },
  {
    slug: "canopy-zipline-circuit",
    title: "Valley Zipline Circuit",
    category: "adventure",
    summary: "Fly across the valley on a series of lines high above the forest.",
    description:
      "A circuit of ziplines and suspended walkways crosses the valley. The team briefs and harnesses every guest before the first launch.",
    highlights: ["Six lines and two sky bridges", "Full safety briefing", "Photos from the final platform"],
    interests: ["thrills", "forest"],
    location: "Valley Zipline",
    meetingPoint: "Adventure centre",
    accessible: false,
    durationMinutes: 180,
    difficulty: "moderate",
    maxGroupSize: 10,
    minAge: 12,
    priceFromMinor: 15000,
    currency: "USD",
    image: img("canopy-zipline-circuit", "Illustration of a zipline cable across a mountain valley"),
    featured: false,
  },
  {
    slug: "lakeside-sunrise-yoga",
    title: "Lakeside Sunrise Yoga",
    category: "wellness",
    summary: "Slow, grounding practice on the shore as the lake mist rises.",
    description:
      "An unhurried practice suitable for every level on a deck at the water's edge, followed by herbal tea and a few quiet minutes of breathwork.",
    highlights: ["All levels welcome", "Mats and blankets provided", "Herbal tea and breathwork"],
    interests: ["mindfulness", "water"],
    location: "Lake Deck",
    meetingPoint: "Wellness pavilion",
    accessible: true,
    durationMinutes: 90,
    difficulty: "easy",
    maxGroupSize: 12,
    minAge: 12,
    priceFromMinor: 6500,
    currency: "USD",
    image: img("lakeside-sunrise-yoga", "Illustration of stacked stones beside a misty lake"),
    featured: true,
  },
  {
    slug: "forest-thermal-ritual",
    title: "Forest Thermal Ritual",
    category: "wellness",
    summary: "Sauna, cold plunge and botanical steam in a cycle that resets body and mind.",
    description:
      "Move between a wood-fired sauna, a cold plunge and a botanical steam room at your own pace, finishing with a warm drink by the fire.",
    highlights: ["Wood-fired sauna", "Cold plunge pool", "Botanical steam room"],
    interests: ["mindfulness", "forest"],
    location: "Thermal House",
    meetingPoint: "Wellness pavilion",
    accessible: true,
    durationMinutes: 120,
    difficulty: "easy",
    maxGroupSize: 6,
    minAge: 16,
    priceFromMinor: 19000,
    currency: "USD",
    image: img("forest-thermal-ritual", "Illustration of a misty lake at night with smooth stones in the water"),
    featured: false,
  },
  {
    slug: "village-harvest-table",
    title: "Village Harvest Table",
    category: "local-culture",
    summary: "Cook with local growers, then share a long-table supper as the lanterns come on.",
    description:
      "Join farming families from the valley to gather produce and cook traditional dishes together, ending with a shared meal at a lantern-lit long table.",
    highlights: ["Hosted by local families", "Hands-on cooking", "Long-table supper"],
    interests: ["food", "community"],
    location: "Valley farms",
    meetingPoint: "Main lodge",
    accessible: true,
    durationMinutes: 240,
    difficulty: "easy",
    maxGroupSize: 12,
    minAge: 6,
    priceFromMinor: 14000,
    currency: "USD",
    image: img("village-harvest-table", "Illustration of terraced hills with lit houses and lanterns at dusk"),
    featured: true,
  },
  {
    slug: "artisan-craft-workshop",
    title: "Artisan Craft Workshop",
    category: "local-culture",
    summary: "Learn weaving or pottery from makers who keep the valley's traditions alive.",
    description:
      "Spend a morning in a maker's studio learning a traditional craft step by step, and take home the piece you create.",
    highlights: ["Taught by local artisans", "Materials included", "Take your piece home"],
    interests: ["craft", "community"],
    location: "Makers' studios",
    meetingPoint: "Main lodge",
    accessible: true,
    durationMinutes: 180,
    difficulty: "easy",
    maxGroupSize: 8,
    minAge: 8,
    priceFromMinor: 11000,
    currency: "USD",
    image: img("artisan-craft-workshop", "Illustration of terraced green hills with small houses"),
    featured: false,
  },
  {
    slug: "reforestation-morning",
    title: "Reforestation Morning",
    category: "sustainability",
    summary: "Plant native saplings alongside the restoration team and track them over time.",
    description:
      "Work with the restoration team to plant native trees on a recovering hillside. Each sapling is tagged so you can follow its progress after your stay.",
    highlights: ["Guided by the restoration team", "Tools and gloves provided", "Tagged sapling to follow"],
    interests: ["conservation", "forest"],
    location: "Restoration hillside",
    meetingPoint: "Nursery barn",
    accessible: false,
    durationMinutes: 180,
    difficulty: "moderate",
    maxGroupSize: 15,
    minAge: 6,
    priceFromMinor: 4500,
    currency: "USD",
    image: img("reforestation-morning", "Illustration of sunlight falling through tall trees onto young sprouts"),
    featured: true,
  },
  {
    slug: "behind-the-green-scenes",
    title: "Behind the Green Scenes",
    category: "sustainability",
    summary: "See how the resort's energy, water and waste systems are designed to work.",
    description:
      "A walking tour of the systems behind the resort, from energy and water to composting, with time for questions.",
    highlights: ["Small-group walking tour", "Energy, water and waste systems", "Q&A with the operations team"],
    interests: ["conservation", "community"],
    location: "Resort operations",
    meetingPoint: "Main lodge",
    accessible: true,
    durationMinutes: 90,
    difficulty: "easy",
    maxGroupSize: 12,
    minAge: 8,
    priceFromMinor: 0,
    currency: "USD",
    image: img("behind-the-green-scenes", "Illustration of light beams through a tall forest"),
    featured: false,
  },
];

/* ------------------------------------------------------------------ schedule */

/** Two-week sample window. Sessions are generated deterministically inside it. */
export const SAMPLE_WINDOW = { start: "2026-11-02", end: "2026-11-15" } as const;

// days: 0 = Sunday … 6 = Saturday. times: resort time, HH:MM.
const schedules: Record<string, { days: number[]; times: string[] }> = {
  "canopy-sunset-dining": { days: [3, 4, 5, 6], times: ["17:30"] },
  "starlit-observatory": { days: [1, 3, 5, 6], times: ["20:30"] },
  "old-growth-forest-trail": { days: [0, 1, 2, 4, 6], times: ["08:00"] },
  "river-wildlife-canoe": { days: [0, 1, 2, 3, 4, 5, 6], times: ["06:30"] },
  "ridge-line-summit-trek": { days: [2, 6], times: ["07:00"] },
  "canopy-zipline-circuit": { days: [0, 1, 3, 5, 6], times: ["10:00", "14:00"] },
  "lakeside-sunrise-yoga": { days: [0, 1, 2, 3, 4, 5, 6], times: ["07:00"] },
  "forest-thermal-ritual": { days: [0, 2, 4, 5, 6], times: ["16:00", "19:00"] },
  "village-harvest-table": { days: [4, 6], times: ["15:00"] },
  "artisan-craft-workshop": { days: [0, 2, 4], times: ["10:00"] },
  "reforestation-morning": { days: [3, 6], times: ["08:30"] },
  "behind-the-green-scenes": { days: [1, 5], times: ["11:00"] },
};

/** Stable pseudo-random number in [0, 1) so sample seat counts never change between renders. */
function seeded(id: string) {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10_000) / 10_000;
}

const windowDays = Array.from({ length: 14 }, (_, i) => addDays(SAMPLE_WINDOW.start, i));

const slots: ExperienceSlot[] = experiences.flatMap((experience) => {
  const schedule = schedules[experience.slug];
  return windowDays.flatMap((day) => {
    if (!schedule.days.includes(new Date(`${day}T00:00:00Z`).getUTCDay())) return [];
    return schedule.times.map((time) => {
      const id = `${experience.slug}--${day}--${time.replace(":", "")}`;
      const startsAt = `${day}T${time}:00.000Z`;
      const endsAt = new Date(Date.parse(startsAt) + experience.durationMinutes * 60_000).toISOString();
      const roll = seeded(id);
      const booked = roll > 0.86 ? experience.maxGroupSize : Math.floor(roll * experience.maxGroupSize * 0.95);
      return { id, experienceSlug: experience.slug, startsAt, endsAt, capacity: experience.maxGroupSize, booked };
    });
  });
});

/* ------------------------------------------------------------------ bookings */

type SampleBookingSeed = {
  reference: string;
  slug: string;
  startsAt: string;
  partySize: number;
  status: BookingStatus;
  guestName: string;
  /** Shown on the guest's own "My bookings" sample view. */
  ownBooking?: boolean;
};

const bookingSeeds: SampleBookingSeed[] = [
  { reference: "LX-4KQ7", slug: "lakeside-sunrise-yoga", startsAt: "2026-11-03T07:00:00.000Z", partySize: 2, status: "confirmed", guestName: "Sample guest", ownBooking: true },
  { reference: "LX-8TB2", slug: "canopy-sunset-dining", startsAt: "2026-11-05T17:30:00.000Z", partySize: 2, status: "confirmed", guestName: "Sample guest", ownBooking: true },
  { reference: "LX-2MW9", slug: "village-harvest-table", startsAt: "2026-11-07T15:00:00.000Z", partySize: 2, status: "pending", guestName: "Sample guest", ownBooking: true },
  { reference: "LX-6RJ3", slug: "old-growth-forest-trail", startsAt: "2026-10-12T08:00:00.000Z", partySize: 2, status: "completed", guestName: "Sample guest", ownBooking: true },
  { reference: "LX-9PD5", slug: "canopy-zipline-circuit", startsAt: "2026-10-14T10:00:00.000Z", partySize: 1, status: "cancelled", guestName: "Sample guest", ownBooking: true },
  { reference: "LX-3HV8", slug: "ridge-line-summit-trek", startsAt: "2026-11-03T07:00:00.000Z", partySize: 4, status: "confirmed", guestName: "M. Okafor" },
  { reference: "LX-7CN1", slug: "river-wildlife-canoe", startsAt: "2026-11-04T06:30:00.000Z", partySize: 2, status: "confirmed", guestName: "J. Lindqvist" },
  { reference: "LX-5GX4", slug: "forest-thermal-ritual", startsAt: "2026-11-06T19:00:00.000Z", partySize: 3, status: "pending", guestName: "A. Moreau" },
  { reference: "LX-1ZL6", slug: "reforestation-morning", startsAt: "2026-11-07T08:30:00.000Z", partySize: 6, status: "confirmed", guestName: "R. Tanaka" },
  { reference: "LX-0WE2", slug: "starlit-observatory", startsAt: "2026-11-02T20:30:00.000Z", partySize: 2, status: "cancelled", guestName: "S. Haddad" },
];

function toBooking(seed: SampleBookingSeed): BookingSummary {
  const experience = experiences.find((item) => item.slug === seed.slug)!;
  return {
    reference: seed.reference,
    experienceSlug: experience.slug,
    experienceTitle: experience.title,
    category: experience.category,
    startsAt: seed.startsAt,
    endsAt: new Date(Date.parse(seed.startsAt) + experience.durationMinutes * 60_000).toISOString(),
    partySize: seed.partySize,
    totalMinor: experience.priceFromMinor * seed.partySize,
    currency: experience.currency,
    status: seed.status,
    guestName: seed.guestName,
  };
}

/* ------------------------------------------------------------------ accessors */

export async function listExperiences(): Promise<ExperienceSummary[]> {
  return experiences;
}

export async function getExperience(slug: string): Promise<ExperienceSummary | null> {
  return experiences.find((experience) => experience.slug === slug) ?? null;
}

export async function listSlots(experienceSlug?: string): Promise<ExperienceSlot[]> {
  return experienceSlug ? slots.filter((slot) => slot.experienceSlug === experienceSlug) : slots;
}

/** Sample bookings for layout previews only. These are not reservations. */
export async function listSampleBookings(): Promise<BookingSummary[]> {
  return bookingSeeds.map(toBooking);
}

/** The subset shown as "your" bookings in the guest-area sample view. */
export async function listSampleGuestBookings(): Promise<BookingSummary[]> {
  return bookingSeeds.filter((seed) => seed.ownBooking).map(toBooking);
}
