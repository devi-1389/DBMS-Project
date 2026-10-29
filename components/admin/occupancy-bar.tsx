import { cn } from "@/lib/utils";

export function occupancyTone(ratio: number) {
  if (ratio >= 1) return "bg-destructive/80";
  if (ratio >= 0.8) return "bg-gold-500";
  return "bg-forest-600";
}

export function OccupancyBar({
  booked,
  capacity,
  className,
}: {
  booked: number;
  capacity: number;
  className?: string;
}) {
  const ratio = capacity ? booked / capacity : 0;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div aria-hidden="true" className="h-2 w-24 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", occupancyTone(ratio))} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        {booked}/{capacity}
        <span className="sr-only"> seats booked</span>
      </span>
    </div>
  );
}
