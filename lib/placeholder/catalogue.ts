// PLACEHOLDER: the one sample-data module for the frontend phase. Nothing here is real
// inventory, availability or bookings. Titles, prices (INR), schedules, seat counts and
// guest names are invented. Images are generated illustrations.
// Replace these accessors with `server-only` DAL functions in Phase 5. Keep the same
// names and return types so pages only change their import.
import { addDays, resortTime } from "@/lib/format";
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
    priceFromMinor: 550000,
    currency: "INR",
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
    priceFromMinor: 250000,
    currency: "INR",
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
    priceFromMinor: 120000,
    currency: "INR",
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
    priceFromMinor: 180000,
    currency: "INR",
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
    priceFromMinor: 350000,
    currency: "INR",
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
    priceFromMinor: 280000,
    currency: "INR",
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
    priceFromMinor: 90000,
    currency: "INR",
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
    priceFromMinor: 380000,
    currency: "INR",
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
    priceFromMinor: 220000,
    currency: "INR",
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
    priceFromMinor: 150000,
    currency: "INR",
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
    priceFromMinor: 50000,
    currency: "INR",
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
    currency: "INR",
    image: img("behind-the-green-scenes", "Illustration of light beams through a tall forest"),
    featured: false,
  },
  // Added to cover the SOLACE / LUXE-ECO brief: spa, kayaking, cycling, a local food
  // trail, a cultural village tour and a private cabana.
  {
    slug: "signature-spa-ritual",
    title: "Signature Spa Ritual",
    category: "wellness",
    summary: "A ninety-minute warm herbal-oil massage and steam in a private garden suite.",
    description:
      "Your therapist begins with a short consultation, then a warm herbal-oil massage in the Ayurvedic tradition, an herbal steam and time to rest with tea in a private garden suite.",
    highlights: ["Consultation with your therapist", "Warm herbal-oil massage and steam", "Private suite for one or two guests"],
    interests: ["mindfulness"],
    location: "Garden Spa",
    meetingPoint: "Garden Spa reception",
    accessible: true,
    durationMinutes: 90,
    difficulty: "easy",
    maxGroupSize: 2,
    minAge: 16,
    priceFromMinor: 450000,
    currency: "INR",
    image: img("signature-spa-ritual", "Illustration of a misty lake with a lit spa pavilion and stacked stones"),
    featured: false,
  },
  {
    slug: "lake-kayak-expedition",
    title: "Lake Kayak Expedition",
    category: "adventure",
    summary: "Paddle single kayaks across open water to the reed-fringed coves of the far shore.",
    description:
      "After a safety briefing on the jetty, an instructor leads the group across the lake and into quiet coves, with a stop on a sandbar for fresh fruit and coconut water.",
    highlights: ["Single sit-on-top kayaks and life jackets", "Safety briefing and certified instructor", "Sandbar stop with fresh fruit"],
    interests: ["water", "thrills"],
    location: "Boathouse Jetty",
    meetingPoint: "Boathouse",
    accessible: false,
    durationMinutes: 120,
    difficulty: "moderate",
    maxGroupSize: 8,
    minAge: 12,
    priceFromMinor: 160000,
    currency: "INR",
    image: img("lake-kayak-expedition", "Illustration of paddlers crossing a calm lake under a pale sun"),
    featured: false,
  },
  {
    slug: "valley-cycle-trail",
    title: "Valley Cycle Trail",
    category: "sustainability",
    summary: "A guided, car-free ride on shared resort bicycles through farms, forest edges and the old river bridge.",
    description:
      "Ride the resort's shared bicycles along quiet farm tracks and forest edges, stopping at a spice garden and the old stone bridge. Electric bicycles help on the steeper sections.",
    highlights: ["Shared resort bicycles and helmets", "Car-free route on farm tracks", "Spice garden stop"],
    interests: ["forest", "conservation"],
    location: "Valley tracks",
    meetingPoint: "Cycle shed, main lodge",
    accessible: false,
    durationMinutes: 150,
    difficulty: "moderate",
    maxGroupSize: 10,
    minAge: 12,
    priceFromMinor: 100000,
    currency: "INR",
    image: img("valley-cycle-trail", "Illustration of terraced farm hills at dawn"),
    featured: false,
  },
  {
    slug: "inlet-food-trail",
    title: "Inlet Food Trail",
    category: "local-culture",
    summary: "Meet the inlet's fishing families, taste the morning catch and cook a fish curry with a home cook.",
    description:
      "Walk the fish landing and spice stalls with a local host, then cook and share a fish curry, rice and pickles in a family kitchen by the water.",
    highlights: ["Fish landing and spice market walk", "Hands-on cooking in a family kitchen", "Lunch of the day's catch"],
    interests: ["food", "community", "water"],
    location: "North Inlet village",
    meetingPoint: "Main lodge, shuttle stop",
    accessible: true,
    durationMinutes: 180,
    difficulty: "easy",
    maxGroupSize: 10,
    minAge: 6,
    priceFromMinor: 180000,
    currency: "INR",
    image: img("inlet-food-trail", "Illustration of a fishing boat on golden water at dusk"),
    featured: false,
  },
  {
    slug: "heritage-village-walk",
    title: "Heritage Village Walk",
    category: "local-culture",
    summary: "Walk the old village lanes with a local storyteller, from the temple tank to the weavers' street.",
    description:
      "A village storyteller and a resort host lead you past tiled-roof houses, a centuries-old temple tank and the weavers' street, ending with filter coffee in a courtyard home.",
    highlights: ["Village storyteller and host", "Weavers' street and temple tank", "Filter coffee in a courtyard home"],
    interests: ["community", "craft"],
    location: "Old village",
    meetingPoint: "Village gate",
    accessible: false,
    durationMinutes: 150,
    difficulty: "easy",
    maxGroupSize: 12,
    minAge: 0,
    priceFromMinor: 120000,
    currency: "INR",
    image: img("heritage-village-walk", "Illustration of village houses on terraced hills with strung lanterns"),
    featured: false,
  },
  {
    slug: "lakeside-cabana",
    title: "Private Lakeside Cabana",
    category: "luxury",
    summary: "A half-day private cabana on the shore with daybeds, a butler and a picnic of small plates.",
    description:
      "Your cabana has shaded daybeds and a plunge deck on the quiet south shore. Swim, read and doze while your butler brings chilled drinks and a picnic of small plates from the kitchen.",
    highlights: ["Private shaded cabana with daybeds", "Dedicated butler", "Picnic of small plates and drinks"],
    interests: ["water", "food"],
    location: "South Shore",
    meetingPoint: "Main lodge terrace",
    accessible: true,
    durationMinutes: 240,
    difficulty: "easy",
    maxGroupSize: 4,
    minAge: 0,
    priceFromMinor: 400000,
    currency: "INR",
    image: img("lakeside-cabana", "Illustration of a lit cabana pavilion over a calm lake"),
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
  "signature-spa-ritual": { days: [0, 1, 2, 3, 4, 5, 6], times: ["10:00", "14:00", "17:00"] },
  "lake-kayak-expedition": { days: [0, 1, 2, 3, 4, 5, 6], times: ["07:30", "15:30"] },
  "valley-cycle-trail": { days: [0, 1, 3, 4, 6], times: ["06:45", "16:30"] },
  "inlet-food-trail": { days: [0, 3, 5], times: ["11:30"] },
  "heritage-village-walk": { days: [1, 2, 4, 6], times: ["09:00", "16:00"] },
  "lakeside-cabana": { days: [0, 1, 2, 3, 4, 5, 6], times: ["10:00", "14:30"] },
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
      const startsAt = resortTime(day, time).toISOString();
      const endsAt = new Date(Date.parse(startsAt) + experience.durationMinutes * 60_000).toISOString();
      const roll = seeded(id);
      const booked = roll > 0.86 ? experience.maxGroupSize : Math.floor(roll * experience.maxGroupSize * 0.95);
      return { id, experienceSlug: experience.slug, startsAt, endsAt, capacity: experience.maxGroupSize, booked };
    });
  });
});

/* ------------------------------------------------------------------ bookings */

/** A resort-local date and time as an ISO instant. */
const at = (day: string, time: string) => resortTime(day, time).toISOString();

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
  { reference: "LX-4KQ7", slug: "lakeside-sunrise-yoga", startsAt: at("2026-11-03", "07:00"), partySize: 2, status: "confirmed", guestName: "Sample guest", ownBooking: true },
  { reference: "LX-8TB2", slug: "canopy-sunset-dining", startsAt: at("2026-11-05", "17:30"), partySize: 2, status: "confirmed", guestName: "Sample guest", ownBooking: true },
  { reference: "LX-2MW9", slug: "village-harvest-table", startsAt: at("2026-11-07", "15:00"), partySize: 2, status: "pending", guestName: "Sample guest", ownBooking: true },
  { reference: "LX-6RJ3", slug: "old-growth-forest-trail", startsAt: at("2026-10-12", "08:00"), partySize: 2, status: "completed", guestName: "Sample guest", ownBooking: true },
  { reference: "LX-9PD5", slug: "canopy-zipline-circuit", startsAt: at("2026-10-14", "10:00"), partySize: 1, status: "cancelled", guestName: "Sample guest", ownBooking: true },
  { reference: "LX-3HV8", slug: "ridge-line-summit-trek", startsAt: at("2026-11-03", "07:00"), partySize: 4, status: "confirmed", guestName: "M. Okafor" },
  { reference: "LX-7CN1", slug: "river-wildlife-canoe", startsAt: at("2026-11-04", "06:30"), partySize: 2, status: "confirmed", guestName: "J. Lindqvist" },
  { reference: "LX-5GX4", slug: "forest-thermal-ritual", startsAt: at("2026-11-06", "19:00"), partySize: 3, status: "pending", guestName: "A. Moreau" },
  { reference: "LX-1ZL6", slug: "reforestation-morning", startsAt: at("2026-11-07", "08:30"), partySize: 6, status: "confirmed", guestName: "R. Tanaka" },
  { reference: "LX-0WE2", slug: "starlit-observatory", startsAt: at("2026-11-02", "20:30"), partySize: 2, status: "cancelled", guestName: "S. Haddad" },
  { reference: "LX-6SP3", slug: "signature-spa-ritual", startsAt: at("2026-11-06", "14:00"), partySize: 2, status: "confirmed", guestName: "K. Menon" },
  { reference: "LX-4KY8", slug: "lake-kayak-expedition", startsAt: at("2026-11-09", "07:30"), partySize: 3, status: "confirmed", guestName: "P. Sharma" },
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
