"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

export function LeafMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
      <circle cx="16" cy="16" r="15" stroke="currentColor" strokeOpacity="0.45" />
      <path
        d="M16 6.5c5.2 3.4 7.8 7.6 7.8 11.6a7.8 7.8 0 0 1-15.6 0c0-4 2.6-8.2 7.8-11.6Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M16 11v15M16 17.5l3.2-3M16 21l-3.2-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <Link
      href="/"
      aria-label="LUXE-ECO home"
      onClick={(event) => {
        // Already on the landing page: return to the top instead of a no-op navigation.
        if (window.location.pathname === "/") {
          event.preventDefault();
          window.history.replaceState(null, "", "/");
          window.scrollTo({ top: 0 });
        }
      }}
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <LeafMark
        className={cn(
          "size-8 text-gold-400 transition-[transform,color] duration-700 group-hover:rotate-12",
          markClassName,
        )}
      />
      <span className="font-display text-2xl font-semibold tracking-[0.2em]">
        LUXE<span className="text-gold-400">·</span>ECO
      </span>
    </Link>
  );
}
