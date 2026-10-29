import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border bg-card p-5 shadow-sm", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-secondary text-forest-700">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 font-display text-4xl leading-none font-semibold">{value}</p>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
