"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Route, SlidersHorizontal, Sparkles, Ticket, type LucideIcon } from "lucide-react";

import { guestNav, isActivePath, type GuestNavIcon } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export const GUEST_NAV_ICONS: Record<GuestNavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  recommendations: Sparkles,
  bookings: Ticket,
  itinerary: Route,
  preferences: SlidersHorizontal,
};

/** Section tabs for the guest area. */
export function GuestNav() {
  return <GuestNavList pathname={usePathname()} />;
}

/** Same tabs without an active one, for dynamic routes while the pathname streams in. */
export function GuestNavFallback() {
  return <GuestNavList pathname={null} />;
}

function GuestNavList({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Guest area" className="-mx-6 overflow-x-auto px-6 [scrollbar-width:none] lg:mx-0 lg:px-0">
      <ul className="flex min-w-max gap-1 border-b">
        {guestNav.map((item) => {
          const Icon = GUEST_NAV_ICONS[item.icon];
          const active = pathname !== null && isActivePath(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  active
                    ? "border-gold-600 text-foreground"
                    : "border-transparent text-muted-foreground hover:border-forest-800/20 hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
