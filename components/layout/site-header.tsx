"use client";

import { Suspense, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogIn, Menu, ShieldCheck, UserRound } from "lucide-react";

import { LeafMark, Logo } from "@/components/brand/logo";
import { GUEST_NAV_ICONS } from "@/components/layout/guest-nav";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { guestNav, isActivePath, primaryNav, ROUTES } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const SCROLL_THRESHOLD = 24;

function subscribe(callback: () => void) {
  window.addEventListener("scroll", callback, { passive: true });
  return () => window.removeEventListener("scroll", callback);
}

function useScrolled() {
  return useSyncExternalStore(
    subscribe,
    () => window.scrollY > SCROLL_THRESHOLD,
    () => false,
  );
}

/**
 * The pathname is unknown while Next.js prerenders the shell of a dynamic route,
 * so the path-aware header renders inside Suspense with a solid fallback.
 */
export function SiteHeader() {
  return (
    <Suspense fallback={<HeaderBar pathname={null} />}>
      <PathAwareHeader />
    </Suspense>
  );
}

function PathAwareHeader() {
  return <HeaderBar pathname={usePathname()} />;
}

function HeaderBar({ pathname }: { pathname: string | null }) {
  const scrolled = useScrolled();
  // Only the landing hero sits under a transparent header.
  const solid = scrolled || pathname !== ROUTES.home;

  return (
    <header
      data-solid={solid}
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-[background-color,color,box-shadow] duration-500",
        solid
          ? "bg-ivory-50/95 text-forest-900 shadow-[0_1px_0_0_var(--color-border)] backdrop-blur-md"
          : "bg-transparent text-ivory-50",
      )}
    >
      <a
        href="#main"
        className="sr-only rounded-full bg-ivory-50 px-4 py-2 text-sm font-semibold text-forest-900 focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-6 lg:px-10">
        <Logo markClassName={solid ? "text-gold-600" : undefined} />

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-8 text-sm font-medium">
            {primaryNav.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative py-2 transition-opacity after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:bg-current after:transition-transform after:duration-500 hover:opacity-100 hover:after:scale-x-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:after:scale-x-100",
                      active ? "opacity-100 after:scale-x-100" : "opacity-85 after:scale-x-0",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <GuestMenu pathname={pathname} />
          <Button asChild variant={solid ? "default" : "accent"} className="hidden sm:inline-flex">
            <Link href={ROUTES.login}>
              <LogIn />
              Sign in
            </Link>
          </Button>
          <MobileNav pathname={pathname} />
        </div>
      </div>
    </header>
  );
}

function GuestMenu({ pathname }: { pathname: string | null }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="hidden hover:bg-current/10 hover:text-current lg:inline-flex">
          <UserRound />
          Guest area
          <ChevronDown className="size-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Guest area (preview)</DropdownMenuLabel>
        {guestNav.map((item) => {
          const Icon = GUEST_NAV_ICONS[item.icon];
          return (
            <DropdownMenuItem key={item.href} asChild>
              <Link href={item.href} aria-current={isActivePath(pathname, item.href) ? "page" : undefined}>
                <Icon />
                {item.label}
              </Link>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={ROUTES.admin}>
            <ShieldCheck />
            Admin console
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileNav({ pathname }: { pathname: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pendingHref = useRef<string | null>(null);

  // Navigate only after the sheet has closed and released its scroll lock,
  // otherwise the browser can't scroll to the target section.
  const navigateAfterClose = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    pendingHref.current = event.currentTarget.getAttribute("href");
    setOpen(false);
  };

  const linkClass = (href: string) =>
    cn(
      "block py-3 transition-colors hover:text-gold-300 focus-visible:text-gold-300 focus-visible:outline-none",
      isActivePath(pathname, href) && "text-gold-300",
    );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          ref={triggerRef}
          variant="ghost"
          size="icon"
          className="hover:bg-current/10 hover:text-current lg:hidden"
        >
          <Menu className="size-5" />
          <span className="sr-only">Open menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="overflow-y-auto border-forest-800 bg-forest-950 text-ivory-50"
        onCloseAutoFocus={(event) => {
          const href = pendingHref.current;
          if (!href) return;
          pendingHref.current = null;
          event.preventDefault();
          triggerRef.current?.focus({ preventScroll: true });
          router.push(href);
        }}
      >
        <SheetHeader className="px-6 pt-6">
          <SheetTitle className="flex items-center gap-2.5 font-display text-2xl tracking-[0.2em] text-ivory-50">
            <LeafMark className="size-8 text-gold-400" />
            <span>
              LUXE<span className="text-gold-400">·</span>ECO
            </span>
          </SheetTitle>
          <SheetDescription className="text-ivory-100/70">
            Luxury, nature and adventure, matched to you.
          </SheetDescription>
        </SheetHeader>
        <nav aria-label="Mobile" className="space-y-8 px-6">
          <ul className="divide-y divide-ivory-50/10 border-y border-ivory-50/10 font-display text-3xl">
            {primaryNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={navigateAfterClose}
                  aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
                  className={linkClass(item.href)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div>
            <p className="eyebrow text-gold-300">Guest area (preview)</p>
            <ul className="mt-2 text-base">
              {guestNav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} onClick={navigateAfterClose} className={linkClass(item.href)}>
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href={ROUTES.admin} onClick={navigateAfterClose} className={linkClass(ROUTES.admin)}>
                  Admin console
                </Link>
              </li>
            </ul>
          </div>
        </nav>
        <div className="mt-auto p-6">
          <Button asChild variant="accent" size="lg" className="w-full">
            <Link href={ROUTES.login} onClick={navigateAfterClose}>
              <LogIn />
              Sign in
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
