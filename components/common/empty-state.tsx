import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl border border-dashed border-forest-800/20 bg-card/60 px-6 py-14 text-center",
        className,
      )}
    >
      <span className="inline-flex size-14 items-center justify-center rounded-full bg-secondary text-forest-700">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h2 className="mt-5 font-display text-2xl font-semibold">{title}</h2>
      {description && (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-pretty text-muted-foreground">{description}</p>
      )}
      {children && <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}
