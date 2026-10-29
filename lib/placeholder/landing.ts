// PLACEHOLDER: marketing copy for the landing page. Sustainability statements are
// design intentions, not verified claims. Confirm them before launch.
import type { CategoryHighlight } from "@/lib/types/experience";

export const categoryHighlights: CategoryHighlight[] = [
  {
    category: "luxury",
    tagline: "Effortless indulgence",
    description: "Private dining, starlit terraces and hosts who anticipate every detail.",
    image: { src: "/images/placeholder/categories/luxury.webp", alt: "" },
  },
  {
    category: "nature",
    tagline: "Slow and wild",
    description: "Old-growth trails, quiet water and wildlife at the edge of first light.",
    image: { src: "/images/placeholder/categories/nature.webp", alt: "" },
  },
  {
    category: "adventure",
    tagline: "Higher, further",
    description: "Summit treks and valley ziplines, guided by people who know every ridge.",
    image: { src: "/images/placeholder/categories/adventure.webp", alt: "" },
  },
  {
    category: "wellness",
    tagline: "Return to calm",
    description: "Lakeside movement, thermal rituals and space to simply breathe.",
    image: { src: "/images/placeholder/categories/wellness.webp", alt: "" },
  },
  {
    category: "local-culture",
    tagline: "Rooted in place",
    description: "Cook, craft and share a table with the families of the valley.",
    image: { src: "/images/placeholder/categories/local-culture.webp", alt: "" },
  },
  {
    category: "sustainability",
    tagline: "Leave it better",
    description: "Plant native forest and see how a low-impact resort is run.",
    image: { src: "/images/placeholder/categories/sustainability.webp", alt: "" },
  },
];

export const matchingExample = {
  experienceSlug: "river-wildlife-canoe",
  preferences: ["Wildlife", "Water", "Early riser", "Easy pace", "Up to $150"],
  reasons: [
    "Matches your interest in wildlife and water",
    "Easy pace that suits your fitness preference",
    "$120 per guest, within your budget",
    "Dawn departure for an early riser",
  ],
};

export const sustainabilityPillars = [
  {
    icon: "sun",
    title: "Renewable by design",
    description: "Stays and experiences planned around renewable energy and low-impact transport.",
  },
  {
    icon: "droplets",
    title: "Water returned clean",
    description: "Water use kept low, with greywater treated and returned to the land.",
  },
  {
    icon: "sprout",
    title: "Restoring native forest",
    description: "Guests and staff help replant native species on recovering hillsides.",
  },
  {
    icon: "hand-heart",
    title: "Community first",
    description: "Local hosts, makers and growers are partners and are paid fairly.",
  },
] as const;
