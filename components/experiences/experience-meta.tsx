import { Clock, Gauge, Users } from "lucide-react";

import { formatDifficulty, formatDuration } from "@/lib/format";
import type { ExperienceSummary } from "@/lib/types/experience";
import { cn } from "@/lib/utils";

export function ExperienceMeta({
  experience,
  className,
}: {
  experience: Pick<ExperienceSummary, "durationMinutes" | "difficulty" | "maxGroupSize">;
  className?: string;
}) {
  const items = [
    { icon: Clock, label: "Duration", value: formatDuration(experience.durationMinutes) },
    { icon: Gauge, label: "Difficulty", value: formatDifficulty(experience.difficulty) },
    { icon: Users, label: "Group size", value: `Up to ${experience.maxGroupSize}` },
  ];

  return (
    <dl className={cn("flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground", className)}>
      {items.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex items-center gap-1.5">
          <dt>
            <Icon className="size-4 text-gold-600" aria-hidden="true" />
            <span className="sr-only">{label}</span>
          </dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
