"use client";

import Link from "next/link";
import { SignOutButton, UserButton } from "@clerk/nextjs";
import { CalendarClock, ChevronDown, LogIn, LogOut, ShieldCheck, UserRound } from "lucide-react";

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
import { canAccess, ROLE_LABELS, type UserRole } from "@/lib/auth/roles";
import { guestNav, ROUTES } from "@/lib/navigation";

/** What the header may know about the viewer. Links are convenience only. */
export type AccountSummary = { displayName: string; role: UserRole } | null;

function roleLinks(viewer: AccountSummary) {
  const links: { label: string; href: string; icon: typeof ShieldCheck }[] = [];
  if (viewer && canAccess(viewer.role, "staff")) links.push({ label: "Staff schedule", href: ROUTES.staff, icon: CalendarClock });
  if (viewer && canAccess(viewer.role, "admin")) links.push({ label: "Admin console", href: ROUTES.admin, icon: ShieldCheck });
  return links;
}

export function SignInButtons() {
  return (
    <Button asChild variant="accent" className="hidden sm:inline-flex">
      <Link href={ROUTES.login}>
        <LogIn />
        Sign in
      </Link>
    </Button>
  );
}

export function AccountMenu({ viewer }: { viewer: AccountSummary }) {
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="hidden hover:bg-current/10 hover:text-current lg:inline-flex">
            <UserRound />
            {viewer?.displayName.split(" ")[0] || "Account"}
            <ChevronDown className="size-3.5 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{viewer ? `${ROLE_LABELS[viewer.role]} account` : "Your account"}</DropdownMenuLabel>
          {guestNav.map((item) => {
            const Icon = GUEST_NAV_ICONS[item.icon];
            return (
              <DropdownMenuItem key={item.href} asChild>
                <Link href={item.href}>
                  <Icon />
                  {item.label}
                </Link>
              </DropdownMenuItem>
            );
          })}
          {roleLinks(viewer).length > 0 && <DropdownMenuSeparator />}
          {roleLinks(viewer).map(({ label, href, icon: Icon }) => (
            <DropdownMenuItem key={href} asChild>
              <Link href={href}>
                <Icon />
                {label}
              </Link>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <SignOutButton redirectUrl={ROUTES.home}>
            <DropdownMenuItem>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </SignOutButton>
        </DropdownMenuContent>
      </DropdownMenu>
      <UserButton />
    </div>
  );
}

const mobileLinkClass =
  "block py-3 transition-colors hover:text-gold-300 focus-visible:text-gold-300 focus-visible:outline-none";

export function MobileAccountLinks({ viewer, signedIn }: { viewer: AccountSummary; signedIn: boolean }) {
  if (!signedIn) {
    return (
      <div className="space-y-3">
        <p className="eyebrow text-gold-300">Your account</p>
        <Button asChild variant="accent" size="lg" className="w-full">
          <Link href={ROUTES.login}>
            <LogIn />
            Sign in
          </Link>
        </Button>
        <Button asChild variant="inverse" size="lg" className="w-full">
          <Link href={ROUTES.signUp}>Create an account</Link>
        </Button>
      </div>
    );
  }
  return (
    <div>
      <p className="eyebrow text-gold-300">{viewer ? `${ROLE_LABELS[viewer.role]} account` : "Your account"}</p>
      <ul className="mt-2 text-base">
        {[...guestNav, ...roleLinks(viewer)].map((item) => (
          <li key={item.href}>
            <Link href={item.href} className={mobileLinkClass}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
      <SignOutButton redirectUrl={ROUTES.home}>
        <Button variant="inverse" size="lg" className="mt-4 w-full">
          <LogOut />
          Sign out
        </Button>
      </SignOutButton>
    </div>
  );
}
