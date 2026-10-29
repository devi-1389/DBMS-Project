import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/lib/navigation";

/** Split-screen layout shared by sign-in and sign-up. */
export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid w-full lg:grid-cols-[1.05fr_1fr]">
      <div className="relative isolate hidden overflow-hidden bg-forest-950 text-ivory-50 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Image
          src="/images/placeholder/categories/luxury.webp"
          alt=""
          fill
          sizes="50vw"
          className="-z-20 object-cover"
          preload
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-t from-forest-950/90 via-forest-950/30 to-forest-950/60"
        />
        <Logo />
        <div className="max-w-md">
          <p className="eyebrow text-gold-300">Guest accounts</p>
          <p className="mt-4 font-display text-4xl leading-tight">
            Save what moves you, plan your days and see every booking in one place.
          </p>
        </div>
      </div>

      <div className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <div className="text-forest-900 lg:invisible">
            <Logo />
          </div>
          <Link
            href={ROUTES.home}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to site
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
          <h1 className="font-display text-4xl font-medium sm:text-5xl">{title}</h1>
          <p className="mt-3 text-muted-foreground">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function AuthFormSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading sign-in">
      <Skeleton className="h-11 w-full rounded-lg" />
      <Skeleton className="h-11 w-full rounded-lg" />
      <Skeleton className="h-11 w-full rounded-full" />
    </div>
  );
}
