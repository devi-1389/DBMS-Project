import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {item.href && !last ? (
                <Link href={item.href} className="transition-colors hover:text-foreground">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={cn(last && "text-foreground")}>
                  {item.label}
                </span>
              )}
              {!last && <ChevronRight className="size-3.5" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  breadcrumbs,
  actions,
  size = "default",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumbs?: Crumb[];
  actions?: React.ReactNode;
  size?: "default" | "compact";
  className?: string;
}) {
  return (
    <header className={cn(size === "default" ? "pt-10 pb-10 sm:pt-14" : "pb-8", className)}>
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} className="mb-6" />}
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          {eyebrow && <p className="eyebrow text-gold-700">{eyebrow}</p>}
          <h1
            className={cn(
              "font-display leading-[1.05] font-medium text-balance",
              eyebrow && "mt-3",
              size === "default" ? "text-4xl sm:text-5xl lg:text-6xl" : "text-3xl sm:text-4xl",
            )}
          >
            {title}
          </h1>
          {description && (
            <p className="mt-4 text-lg leading-relaxed text-pretty text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
      </div>
    </header>
  );
}
