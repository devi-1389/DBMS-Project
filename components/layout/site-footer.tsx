import Link from "next/link";
import { ArrowUp } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { CATEGORY_LABELS, EXPERIENCE_CATEGORIES } from "@/lib/categories";
import { categoryHref, guestNav, primaryNav, ROUTES } from "@/lib/navigation";

const linkClass =
  "text-ivory-100/70 transition-colors hover:text-gold-300 focus-visible:text-gold-300 focus-visible:outline-none";

const columns = [
  { title: "Explore", label: "Footer", links: primaryNav },
  {
    title: "Categories",
    label: "Experience categories",
    links: EXPERIENCE_CATEGORIES.map((category) => ({ label: CATEGORY_LABELS[category], href: categoryHref(category) })),
  },
  {
    title: "Guest area",
    label: "Guest area",
    links: [
      ...guestNav,
      { label: "Sign in", href: ROUTES.login },
      { label: "Admin console", href: ROUTES.admin },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-forest-950 text-ivory-50">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 sm:grid-cols-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-10">
        <div className="max-w-sm sm:col-span-3 lg:col-span-1">
          <Logo />
          <p className="mt-6 leading-relaxed text-ivory-100/70">
            An integrated luxury, nature and adventure resort, where every experience is matched to
            the way you like to travel.
          </p>
        </div>

        {columns.map((column) => (
          <nav key={column.title} aria-label={column.label}>
            <h2 className="eyebrow text-gold-300">{column.title}</h2>
            <ul className="mt-5 space-y-3 text-sm">
              {column.links.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={linkClass}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-ivory-50/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-6 text-xs text-ivory-100/60 sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <p>© LUXE-ECO. Preview site: experiences, prices, availability and illustrations are placeholders.</p>
          <a href="#main" className={`inline-flex items-center gap-2 ${linkClass}`}>
            Back to top <ArrowUp className="size-3.5" />
          </a>
        </div>
      </div>
    </footer>
  );
}
