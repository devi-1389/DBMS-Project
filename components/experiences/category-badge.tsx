import { CategoryIcon } from "@/components/experiences/category-icon";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABELS, type ExperienceCategory } from "@/lib/categories";

export function CategoryBadge({
  category,
  className,
}: {
  category: ExperienceCategory;
  className?: string;
}) {
  return (
    <Badge variant="glass" className={className}>
      <CategoryIcon category={category} className="text-gold-700" />
      {CATEGORY_LABELS[category]}
    </Badge>
  );
}
