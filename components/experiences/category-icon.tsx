import { Flower2, Gem, HandHeart, Mountain, Sprout, Trees, type LucideProps } from "lucide-react";

import type { ExperienceCategory } from "@/lib/categories";

const ICONS = {
  luxury: Gem,
  nature: Trees,
  adventure: Mountain,
  wellness: Flower2,
  "local-culture": HandHeart,
  sustainability: Sprout,
} satisfies Record<ExperienceCategory, React.ComponentType<LucideProps>>;

export function CategoryIcon({ category, ...props }: { category: ExperienceCategory } & LucideProps) {
  const Icon = ICONS[category];
  return <Icon aria-hidden="true" {...props} />;
}
